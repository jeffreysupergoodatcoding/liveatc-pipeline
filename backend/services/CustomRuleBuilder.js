import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Custom Rule Builder Service
 * Manages user-defined detection rules
 */
export class CustomRuleBuilder {
  constructor(config = {}) {
    this.rulesPath = config.rulesPath || path.join(__dirname, '../data/custom_rules.json');
    this.rules = [];
  }

  /**
   * Initialize - load existing rules
   */
  async initialize() {
    try {
      const data = await fs.readFile(this.rulesPath, 'utf8');
      this.rules = JSON.parse(data);
      console.log(`Loaded ${this.rules.length} custom rules`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, start with empty rules
        this.rules = [];
        await this.save();
      } else {
        throw error;
      }
    }
  }

  /**
   * Get all rules
   */
  async getAllRules() {
    return this.rules.filter(r => r.enabled !== false);
  }

  /**
   * Get rule by ID
   */
  async getRuleById(id) {
    return this.rules.find(r => r.id === id);
  }

  /**
   * Create new rule
   */
  async createRule(ruleData) {
    // Validate required fields
    this._validateRule(ruleData);

    // Generate ID if not provided
    if (!ruleData.id) {
      ruleData.id = `custom-${Date.now()}`;
    }

    // Check for duplicate ID
    if (this.rules.find(r => r.id === ruleData.id)) {
      throw new Error(`Rule with ID ${ruleData.id} already exists`);
    }

    const rule = {
      ...ruleData,
      enabled: ruleData.enabled !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.rules.push(rule);
    await this.save();

    return rule;
  }

  /**
   * Update existing rule
   */
  async updateRule(id, updates) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error(`Rule with ID ${id} not found`);
    }

    // Validate if conditions are being updated
    if (updates.conditions) {
      this._validateRule({ ...this.rules[index], ...updates });
    }

    this.rules[index] = {
      ...this.rules[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    await this.save();

    return this.rules[index];
  }

  /**
   * Delete rule
   */
  async deleteRule(id) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error(`Rule with ID ${id} not found`);
    }

    const deleted = this.rules.splice(index, 1)[0];
    await this.save();

    return deleted;
  }

  /**
   * Toggle rule enabled/disabled
   */
  async toggleRule(id) {
    const rule = this.rules.find(r => r.id === id);
    if (!rule) {
      throw new Error(`Rule with ID ${id} not found`);
    }

    rule.enabled = !rule.enabled;
    rule.updated_at = new Date().toISOString();
    await this.save();

    return rule;
  }

  /**
   * Validate rule structure
   */
  _validateRule(rule) {
    if (!rule.name) {
      throw new Error('Rule must have a name');
    }

    if (!rule.conditions || typeof rule.conditions !== 'object') {
      throw new Error('Rule must have conditions object');
    }

    // At least one condition must be specified
    const validConditions = [
      'keywords',
      'speech_rate',
      'multiple_speakers',
      'high_volume_variance',
      'min_confidence',
      'max_duration',
      'min_duration'
    ];

    const hasValidCondition = Object.keys(rule.conditions).some(key =>
      validConditions.includes(key)
    );

    if (!hasValidCondition) {
      throw new Error(
        `Rule must have at least one valid condition: ${validConditions.join(', ')}`
      );
    }

    // Validate keywords if present
    if (rule.conditions.keywords && !Array.isArray(rule.conditions.keywords)) {
      throw new Error('keywords condition must be an array');
    }

    // Validate speech_rate if present
    if (rule.conditions.speech_rate) {
      const valid = /^[<>]\d+$/.test(rule.conditions.speech_rate);
      if (!valid) {
        throw new Error('speech_rate must be in format ">200" or "<100"');
      }
    }

    // Validate priority if present
    if (rule.priority && !['low', 'medium', 'high', 'critical'].includes(rule.priority)) {
      throw new Error('priority must be one of: low, medium, high, critical');
    }
  }

  /**
   * Save rules to file
   */
  async save() {
    await fs.writeFile(this.rulesPath, JSON.stringify(this.rules, null, 2), 'utf8');
  }

  /**
   * Import rules from file
   */
  async importRules(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    const importedRules = JSON.parse(data);

    if (!Array.isArray(importedRules)) {
      throw new Error('Imported data must be an array of rules');
    }

    for (const rule of importedRules) {
      this._validateRule(rule);

      // Check for duplicate IDs
      const existing = this.rules.find(r => r.id === rule.id);
      if (existing) {
        // Update existing rule
        const index = this.rules.indexOf(existing);
        this.rules[index] = {
          ...rule,
          updated_at: new Date().toISOString()
        };
      } else {
        // Add new rule
        this.rules.push({
          ...rule,
          created_at: rule.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    await this.save();

    return {
      imported: importedRules.length,
      total: this.rules.length
    };
  }

  /**
   * Export rules to file
   */
  async exportRules(filePath = null) {
    const exportData = JSON.stringify(this.rules, null, 2);

    if (filePath) {
      await fs.writeFile(filePath, exportData, 'utf8');
      return { path: filePath, count: this.rules.length };
    }

    return {
      data: exportData,
      count: this.rules.length
    };
  }

  /**
   * Get rule templates
   */
  getRuleTemplates() {
    return [
      {
        name: 'High Workload Detection',
        description: 'Detects high workload communications',
        conditions: {
          keywords: ['unable', 'standby', 'say again'],
          speech_rate: '>200',
          multiple_speakers: true
        },
        priority: 'medium'
      },
      {
        name: 'Emergency Keywords',
        description: 'Detects emergency-related keywords',
        conditions: {
          keywords: ['emergency', 'mayday', 'pan pan', 'fire', 'smoke']
        },
        priority: 'critical'
      },
      {
        name: 'Confusion Indicators',
        description: 'Detects confusion or uncertainty',
        conditions: {
          keywords: ['confused', 'not sure', 'which', 'where', 'clarify']
        },
        priority: 'medium'
      },
      {
        name: 'Rapid Speech',
        description: 'Detects unusually fast speech patterns',
        conditions: {
          speech_rate: '>250',
          high_volume_variance: true
        },
        priority: 'high'
      },
      {
        name: 'Multiple Speaker Overlap',
        description: 'Detects communications with multiple speakers',
        conditions: {
          multiple_speakers: true,
          keywords: ['say again', 'blocked']
        },
        priority: 'medium'
      }
    ];
  }

  /**
   * Test rule against sample data
   */
  testRule(rule, sampleTranscription) {
    // Simulate testing a rule against sample data
    const matches = [];

    if (rule.conditions.keywords) {
      const text = sampleTranscription.text.toLowerCase();
      const matchedKeywords = rule.conditions.keywords.filter(kw =>
        text.includes(kw.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        matches.push({
          condition: 'keywords',
          matched: matchedKeywords
        });
      }
    }

    if (rule.conditions.speech_rate) {
      const wordsPerMinute = (sampleTranscription.words?.length || 0) /
        (sampleTranscription.duration / 60);
      const operator = rule.conditions.speech_rate.charAt(0);
      const threshold = parseFloat(rule.conditions.speech_rate.slice(1));

      let matched = false;
      if (operator === '>' && wordsPerMinute > threshold) matched = true;
      if (operator === '<' && wordsPerMinute < threshold) matched = true;

      if (matched) {
        matches.push({
          condition: 'speech_rate',
          value: wordsPerMinute,
          threshold
        });
      }
    }

    return {
      matched: matches.length > 0,
      matches,
      confidence: matches.length / Object.keys(rule.conditions).length
    };
  }
}
