'use client';

import { useState, useEffect } from 'react';
import styles from './CustomRules.module.css';

export default function CustomRules() {
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchRules();
    fetchTemplates();
  }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const response = await fetch('/api/edge-cases/rules');
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/edge-cases/rules/templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }

  async function toggleRule(ruleId, currentState) {
    try {
      const response = await fetch(`/api/edge-cases/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentState })
      });

      if (response.ok) {
        fetchRules();
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  }

  async function deleteRule(ruleId) {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/edge-cases/rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchRules();
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  }

  async function createRule(ruleData) {
    try {
      const response = await fetch('/api/edge-cases/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });

      if (response.ok) {
        setShowCreateForm(false);
        fetchRules();
      }
    } catch (error) {
      console.error('Error creating rule:', error);
    }
  }

  async function updateRule(ruleId, ruleData) {
    try {
      const response = await fetch(`/api/edge-cases/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });

      if (response.ok) {
        setEditingRule(null);
        fetchRules();
      }
    } catch (error) {
      console.error('Error updating rule:', error);
    }
  }

  function useTemplate(template) {
    setShowCreateForm(true);
    setEditingRule({
      id: null,
      name: template.name,
      description: template.description,
      conditions: template.conditions,
      priority: template.priority
    });
  }

  if (loading) {
    return <div className={styles.loading}>Loading custom rules...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3>Custom Detection Rules</h3>
          <p className={styles.subtitle}>Create and manage custom edge case detection rules</p>
        </div>
        <button
          className={styles.createButton}
          onClick={() => {
            setShowCreateForm(true);
            setEditingRule({
              id: null,
              name: '',
              description: '',
              conditions: { keywords: [], min_severity: 0.5, audio_analysis: {} },
              priority: 'medium'
            });
          }}
        >
          + Create Rule
        </button>
      </div>

      {showCreateForm || editingRule ? (
        <RuleForm
          rule={editingRule}
          onSave={(data) => {
            if (editingRule.id) {
              updateRule(editingRule.id, data);
            } else {
              createRule(data);
            }
          }}
          onCancel={() => {
            setShowCreateForm(false);
            setEditingRule(null);
          }}
        />
      ) : null}

      <div className={styles.content}>
        <div className={styles.rulesSection}>
          <h4>Active Rules ({rules.filter(r => r.enabled).length})</h4>
          {rules.length === 0 ? (
            <div className={styles.empty}>
              <p>No custom rules yet</p>
              <span>Create your first rule or use a template below</span>
            </div>
          ) : (
            <div className={styles.rulesList}>
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={() => toggleRule(rule.id, rule.enabled)}
                  onEdit={() => setEditingRule(rule)}
                  onDelete={() => deleteRule(rule.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.templatesSection}>
          <h4>Rule Templates</h4>
          <p className={styles.templateDesc}>Quick-start templates for common detection scenarios</p>
          <div className={styles.templatesList}>
            {templates.map((template, i) => (
              <TemplateCard
                key={i}
                template={template}
                onUse={() => useTemplate(template)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleCard({ rule, onToggle, onEdit, onDelete }) {
  const priorityColors = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#eab308',
    low: '#3b82f6'
  };

  return (
    <div className={`${styles.ruleCard} ${!rule.enabled ? styles.disabled : ''}`}>
      <div className={styles.ruleHeader}>
        <div className={styles.ruleInfo}>
          <h5>{rule.name}</h5>
          <p>{rule.description}</p>
        </div>
        <div className={styles.ruleControls}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={onToggle}
            />
            <span className={styles.slider}></span>
          </label>
        </div>
      </div>

      <div className={styles.ruleDetails}>
        <span
          className={styles.priorityBadge}
          style={{ background: priorityColors[rule.priority] }}
        >
          {rule.priority}
        </span>

        {rule.conditions.keywords && rule.conditions.keywords.length > 0 && (
          <span className={styles.conditionBadge}>
            {rule.conditions.keywords.length} keywords
          </span>
        )}

        {rule.conditions.min_severity && (
          <span className={styles.conditionBadge}>
            Min severity: {rule.conditions.min_severity}
          </span>
        )}
      </div>

      <div className={styles.ruleActions}>
        <button onClick={onEdit} className={styles.editButton}>Edit</button>
        <button onClick={onDelete} className={styles.deleteButton}>Delete</button>
      </div>
    </div>
  );
}

function TemplateCard({ template, onUse }) {
  return (
    <div className={styles.templateCard}>
      <h5>{template.name}</h5>
      <p>{template.description}</p>
      <button onClick={onUse} className={styles.useTemplateButton}>
        Use Template
      </button>
    </div>
  );
}

function RuleForm({ rule, onSave, onCancel }) {
  const [formData, setFormData] = useState(rule || {
    name: '',
    description: '',
    conditions: { keywords: [], min_severity: 0.5, audio_analysis: {} },
    priority: 'medium'
  });

  const [keywordInput, setKeywordInput] = useState('');

  function addKeyword() {
    if (!keywordInput.trim()) return;
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        keywords: [...(formData.conditions.keywords || []), keywordInput.trim()]
      }
    });
    setKeywordInput('');
  }

  function removeKeyword(index) {
    const newKeywords = [...formData.conditions.keywords];
    newKeywords.splice(index, 1);
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        keywords: newKeywords
      }
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div className={styles.formOverlay}>
      <div className={styles.formContainer}>
        <div className={styles.formHeader}>
          <h4>{rule?.id ? 'Edit Rule' : 'Create New Rule'}</h4>
          <button onClick={onCancel} className={styles.closeButton}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Rule Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Rapid Fire Communications"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this rule detects..."
              rows={3}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Priority *</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Detection Keywords</label>
            <div className={styles.keywordInput}>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Type a keyword and press Enter"
              />
              <button type="button" onClick={addKeyword} className={styles.addButton}>
                Add
              </button>
            </div>
            <div className={styles.keywords}>
              {formData.conditions.keywords?.map((kw, i) => (
                <span key={i} className={styles.keyword}>
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(i)}
                    className={styles.removeKeyword}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Minimum Severity Score</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.conditions.min_severity || 0.5}
              onChange={(e) => setFormData({
                ...formData,
                conditions: {
                  ...formData.conditions,
                  min_severity: parseFloat(e.target.value)
                }
              })}
            />
            <span className={styles.severityValue}>
              {(formData.conditions.min_severity || 0.5).toFixed(1)}
            </span>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.saveButton}>
              {rule?.id ? 'Update Rule' : 'Create Rule'}
            </button>
            <button type="button" onClick={onCancel} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
