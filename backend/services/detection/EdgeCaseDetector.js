import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AudioAnalyzer } from './AudioAnalyzer.js';
import { ContentAnalyzer } from './ContentAnalyzer.js';
import { getSTTProvider } from '../transcription/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Edge Case Detection Service
 * Multi-modal detector combining audio analysis, content analysis, and pattern matching
 */
export class EdgeCaseDetector {
  constructor(config = {}) {
    this.config = {
      mode: config.mode || process.env.DETECTION_MODE || 'hybrid', // 'built-in', 'custom', 'hybrid'
      taxonomyPath: config.taxonomyPath || path.join(__dirname, '../../data/edge_case_taxonomy.json'),
      sttProvider: config.sttProvider || null,
      customRules: config.customRules || [],
      ...config
    };

    this.taxonomy = null;
    this.audioAnalyzer = new AudioAnalyzer();
    this.contentAnalyzer = null;
    this.stt = null;
  }

  /**
   * Initialize detector (load taxonomy, setup STT)
   */
  async initialize() {
    // Load taxonomy
    const taxonomyData = await fs.readFile(this.config.taxonomyPath, 'utf8');
    this.taxonomy = JSON.parse(taxonomyData);

    // Initialize content analyzer with taxonomy
    this.contentAnalyzer = new ContentAnalyzer(this.taxonomy);

    // Initialize STT provider
    if (!this.stt) {
      this.stt = getSTTProvider(this.config.sttProvider);
    }

    console.log(`Edge Case Detector initialized (mode: ${this.config.mode})`);
    console.log(`Loaded ${this.taxonomy.metadata.total_cases} built-in edge cases`);
    console.log(`Loaded ${this.config.customRules.length} custom rules`);
  }

  /**
   * Detect edge cases in audio file
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Detection options
   * @returns {Promise<EdgeCaseDetectionResult>}
   */
  /**
   * Detect edge cases in audio file
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Detection options
   * @returns {Promise<EdgeCaseDetectionResult>}
   */
  async detect(audioPath, options = {}) {
    if (!this.taxonomy) {
      await this.initialize();
    }

    console.log(`Analyzing: ${path.basename(audioPath)}`);

    // Step 1: Transcription (Primary Signal)
    console.log('  Transcribing audio...');
    const transcription = options.transcription || await this.stt.transcribe(audioPath);

    // Step 2: Audio Analysis (Secondary/Metadata)
    console.log('  Running audio analysis...');
    const audioAnalysis = await this.audioAnalyzer.analyze(audioPath);

    // Step 3: Confidence-based Routing
    const confidence = transcription.confidence;
    const rlhfThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD_RLHF || 0.85);
    const humanReviewThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD_HUMAN || 0.85);

    let routing = {
      isEdgeCase: false,
      route: 'unknown',
      needsHumanReview: false,
      rlhfCandidate: false
    };

    if (confidence >= rlhfThreshold) {
      // High confidence -> Good candidate for RLHF / synthetic data generation
      routing = {
        isEdgeCase: false,
        route: 'generate_rlhf_variations',
        needsHumanReview: false,
        rlhfCandidate: true,
        reason: 'high_confidence_transcription'
      };
    } else {
      // Low confidence -> Edge case needing human review
      routing = {
        isEdgeCase: true,
        route: 'human_labeling',
        needsHumanReview: true,
        rlhfCandidate: false,
        reason: 'low_confidence_transcription'
      };
    }

    // Still run content analysis for metadata/categorization if possible
    let contentAnalysis = {};
    let detectedCases = [];
    if (transcription.text) {
      console.log('  Analyzing content...');
      contentAnalysis = this.contentAnalyzer.analyze(transcription, audioAnalysis);
      console.log('  Matching patterns...');
      detectedCases = this._matchPatterns(contentAnalysis, audioAnalysis, transcription);
    }

    // Apply Custom Rules (still valuable for specific tagging)
    const customMatches = this._applyCustomRules(transcription, audioAnalysis, contentAnalysis);

    // Calculate score (legacy/hybrid score) - helpful for sorting within the buckets
    const edgeCaseScore = this._calculateEdgeCaseScore(detectedCases, customMatches, contentAnalysis);

    // Compile Results
    const result = {
      audioPath,
      transcription: {
        text: transcription.text,
        confidence: transcription.confidence,
        duration: transcription.duration,
        speakerCount: transcription.speakerCount
      },
      audioAnalysis: {
        duration: audioAnalysis.duration,
        speechDensity: audioAnalysis.speechDensity,
        volumeVariance: audioAnalysis.volumeVariance,
        overlappingTransmissions: audioAnalysis.overlappingTransmissions
      },
      routing, // New field for routing decision
      detectedEdgeCases: detectedCases,
      customRuleMatches: customMatches,
      edgeCaseScore,
      communicationQuality: contentAnalysis.communicationQuality || {},
      flagged: routing.isEdgeCase, // Legacy compatibility
      summary: this._generateSummary(detectedCases, customMatches, edgeCaseScore, routing)
    };

    console.log(`  Confidence: ${confidence.toFixed(2)}`);
    console.log(`  Route: ${routing.route}`);
    console.log(`  Flagged: ${result.flagged ? 'YES' : 'NO'}`);

    return result;
  }


  /**
   * Match patterns against taxonomy
   */
  _matchPatterns(contentAnalysis, audioAnalysis, transcription) {
    const matches = [];

    // Skip if mode is 'custom' only
    if (this.config.mode === 'custom') {
      return matches;
    }

    // Keyword matches from content analysis
    for (const keywordMatch of contentAnalysis.keywords) {
      matches.push({
        caseId: keywordMatch.caseId,
        caseName: keywordMatch.caseName,
        category: keywordMatch.category,
        severity: keywordMatch.severity,
        confidence: keywordMatch.confidence,
        matchType: 'keyword',
        evidence: {
          keywords: keywordMatch.matchedKeywords
        }
      });
    }

    // Emergency indicators
    for (const emergency of contentAnalysis.emergencyIndicators) {
      const emergencyCase = this._findCaseByType(emergency.type);
      if (emergencyCase) {
        matches.push({
          caseId: emergencyCase.id,
          caseName: emergencyCase.name,
          category: 'emergency_declarations',
          severity: emergency.severity,
          confidence: 0.95,
          matchType: 'emergency_indicator',
          evidence: emergency
        });
      }
    }

    // Readback errors
    for (const error of contentAnalysis.readbackErrors) {
      matches.push({
        caseId: 'RB-001', // Generic readback error
        caseName: 'Readback Error Detected',
        category: 'readback_errors',
        severity: error.severity,
        confidence: 0.8,
        matchType: 'readback_error',
        evidence: error
      });
    }

    // Phraseology issues
    for (const issue of contentAnalysis.phraseologyIssues) {
      matches.push({
        caseId: 'PH-001',
        caseName: 'Phraseology Issue',
        category: 'phraseology_issues',
        severity: issue.severity,
        confidence: 0.7,
        matchType: 'phraseology_issue',
        evidence: issue
      });
    }

    // Communication failures (overlapping transmissions)
    if (audioAnalysis.overlappingTransmissions.detected) {
      matches.push({
        caseId: 'CF-001',
        caseName: 'Stepped-On Transmission',
        category: 'communication_failures',
        severity: 0.6,
        confidence: audioAnalysis.overlappingTransmissions.confidence,
        matchType: 'audio_signature',
        evidence: audioAnalysis.overlappingTransmissions
      });
    }

    // High workload indication
    if (contentAnalysis.speakerPatterns.isHighWorkload) {
      matches.push({
        caseId: 'OP-001',
        caseName: 'High Workload Indication',
        category: 'operational_issues',
        severity: 0.6,
        confidence: 0.7,
        matchType: 'speaker_pattern',
        evidence: contentAnalysis.speakerPatterns
      });
    }

    return matches;
  }

  /**
   * Apply custom user-defined rules
   */
  _applyCustomRules(transcription, audioAnalysis, contentAnalysis) {
    const matches = [];

    // Skip if mode is 'built-in' only
    if (this.config.mode === 'built-in') {
      return matches;
    }

    for (const rule of this.config.customRules) {
      const match = this._evaluateCustomRule(rule, transcription, audioAnalysis, contentAnalysis);
      if (match.matched) {
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          priority: rule.priority || 'medium',
          confidence: match.confidence,
          matchedConditions: match.matchedConditions,
          evidence: match.evidence
        });
      }
    }

    return matches;
  }

  /**
   * Evaluate a single custom rule
   */
  _evaluateCustomRule(rule, transcription, audioAnalysis, contentAnalysis) {
    const conditions = rule.conditions || {};
    const matchedConditions = [];
    let totalConfidence = 0;
    let conditionCount = 0;

    // Check keyword conditions
    if (conditions.keywords && conditions.keywords.length > 0) {
      const text = transcription.text.toLowerCase();
      const matchedKeywords = conditions.keywords.filter(kw => text.includes(kw.toLowerCase()));

      if (matchedKeywords.length > 0) {
        matchedConditions.push({
          type: 'keywords',
          matched: matchedKeywords,
          confidence: matchedKeywords.length / conditions.keywords.length
        });
        totalConfidence += matchedKeywords.length / conditions.keywords.length;
      }
      conditionCount++;
    }

    // Check speech rate condition
    if (conditions.speech_rate) {
      const wordsPerMinute = (transcription.words?.length || 0) / (transcription.duration / 60);
      const operator = conditions.speech_rate.charAt(0);
      const threshold = parseFloat(conditions.speech_rate.slice(1));

      let matched = false;
      if (operator === '>' && wordsPerMinute > threshold) matched = true;
      if (operator === '<' && wordsPerMinute < threshold) matched = true;

      if (matched) {
        matchedConditions.push({
          type: 'speech_rate',
          value: wordsPerMinute,
          threshold,
          confidence: 0.8
        });
        totalConfidence += 0.8;
      }
      conditionCount++;
    }

    // Check multiple speakers condition
    if (conditions.multiple_speakers === true) {
      if (transcription.speakerCount > 1) {
        matchedConditions.push({
          type: 'multiple_speakers',
          count: transcription.speakerCount,
          confidence: 0.9
        });
        totalConfidence += 0.9;
      }
      conditionCount++;
    }

    // Check volume conditions
    if (conditions.high_volume_variance === true) {
      if (audioAnalysis.volumeVariance > 12) {
        matchedConditions.push({
          type: 'high_volume_variance',
          value: audioAnalysis.volumeVariance,
          confidence: 0.7
        });
        totalConfidence += 0.7;
      }
      conditionCount++;
    }

    // Rule matches if at least one condition is met
    const matched = matchedConditions.length > 0;
    const confidence = conditionCount > 0 ? totalConfidence / conditionCount : 0;

    return {
      matched,
      confidence,
      matchedConditions,
      evidence: {
        totalConditions: conditionCount,
        matchedCount: matchedConditions.length
      }
    };
  }

  /**
   * Calculate overall edge case likelihood score (0-1)
   */
  _calculateEdgeCaseScore(detectedCases, customMatches, contentAnalysis) {
    // Use the top 3 highest-severity cases instead of summing all
    // This prevents score inflation from many low-severity detections

    const allMatches = [];

    // Add detected cases with their weighted scores
    for (const match of detectedCases) {
      allMatches.push({
        weightedScore: match.severity * match.confidence,
        severity: match.severity
      });
    }

    // Add custom rule matches
    const priorityWeights = { low: 0.3, medium: 0.6, high: 0.9, critical: 1.0 };
    for (const match of customMatches) {
      const weight = priorityWeights[match.priority] || 0.5;
      allMatches.push({
        weightedScore: weight * match.confidence,
        severity: weight
      });
    }

    // Sort by weighted score (highest first) and take top 3
    allMatches.sort((a, b) => b.weightedScore - a.weightedScore);
    const topMatches = allMatches.slice(0, 3);

    // Calculate score from top matches with diminishing weight
    let score = 0;
    if (topMatches.length > 0) {
      score += topMatches[0].weightedScore * 0.6;  // Highest match: 60% weight
      if (topMatches.length > 1) {
        score += topMatches[1].weightedScore * 0.25; // Second match: 25% weight
      }
      if (topMatches.length > 2) {
        score += topMatches[2].weightedScore * 0.15; // Third match: 15% weight
      }
    }

    // Factor in communication quality (poor quality increases edge case likelihood)
    const qualityPenalty = (1 - contentAnalysis.communicationQuality.score) * 0.2;
    score += qualityPenalty;

    // Cap at 1.0
    return Math.min(1.0, score);
  }

  /**
   * Generate human-readable summary
   */
  _generateSummary(detectedCases, customMatches, edgeCaseScore, routing) {
    const parts = [];

    if (routing && routing.route) {
      parts.push(`Routing: ${routing.route.toUpperCase()} (Confidence: ${(routing.isEdgeCase ? 'Low' : 'High')})`);
    }

    if (edgeCaseScore > 0.8) {
      parts.push('CRITICAL: High-priority edge case detected');
    } else if (edgeCaseScore > 0.6) {
      parts.push('WARNING: Significant edge case detected');
    } else if (edgeCaseScore > 0.4) {
      parts.push('NOTICE: Potential edge case detected');
    } else {
      parts.push('Normal communication pattern');
    }

    // Add top matches
    const topMatches = detectedCases
      .sort((a, b) => (b.severity * b.confidence) - (a.severity * a.confidence))
      .slice(0, 3);

    if (topMatches.length > 0) {
      parts.push('\nTop matches:');
      for (const match of topMatches) {
        parts.push(`- ${match.caseName} (${(match.confidence * 100).toFixed(0)}% confidence)`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Find case in taxonomy by type/keywords
   */
  _findCaseByType(type) {
    for (const category of Object.values(this.taxonomy.categories)) {
      for (const edgeCase of category.cases) {
        if (edgeCase.id.toLowerCase().includes(type.toLowerCase()) ||
          edgeCase.name.toLowerCase().includes(type.toLowerCase())) {
          return edgeCase;
        }
      }
    }
    return null;
  }

  /**
   * Load custom rules from file
   */
  async loadCustomRules(rulesPath) {
    const rulesData = await fs.readFile(rulesPath, 'utf8');
    this.config.customRules = JSON.parse(rulesData);
    console.log(`Loaded ${this.config.customRules.length} custom rules from ${rulesPath}`);
  }

  /**
   * Add custom rule
   */
  addCustomRule(rule) {
    if (!rule.id || !rule.name || !rule.conditions) {
      throw new Error('Custom rule must have id, name, and conditions');
    }
    this.config.customRules.push(rule);
  }

  /**
   * Get taxonomy
   */
  getTaxonomy() {
    return this.taxonomy;
  }
}

/**
 * @typedef {Object} EdgeCaseDetectionResult
 * @property {string} audioPath - Path to analyzed audio
 * @property {Object} transcription - Transcription summary
 * @property {Object} audioAnalysis - Audio analysis summary
 * @property {Array} detectedEdgeCases - Matched edge cases from taxonomy
 * @property {Array} customRuleMatches - Matched custom rules
 * @property {number} edgeCaseScore - Overall edge case likelihood (0-1)
 * @property {Object} communicationQuality - Communication quality assessment
 * @property {boolean} flagged - Whether segment should be flagged for review
 * @property {string} summary - Human-readable summary
 */
