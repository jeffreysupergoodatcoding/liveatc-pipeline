'use client';

import { useState, useEffect } from 'react';
import styles from './TaxonomyViewer.module.css';

export default function TaxonomyViewer() {
  const [taxonomy, setTaxonomy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [selectedCase, setSelectedCase] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTaxonomy();
  }, []);

  async function fetchTaxonomy() {
    setLoading(true);
    try {
      const response = await fetch('/api/edge-cases/taxonomy');
      const data = await response.json();
      setTaxonomy(data);
      // Expand all categories by default
      setExpandedCategories(new Set(Object.keys(data.categories)));
    } catch (error) {
      console.error('Error fetching taxonomy:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(categoryKey) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedCategories(newExpanded);
  }

  function filterCases() {
    if (!taxonomy || !searchTerm) return null;

    const filtered = {};
    Object.entries(taxonomy.categories).forEach(([key, category]) => {
      const matchingCases = category.cases.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (matchingCases.length > 0) {
        filtered[key] = { ...category, cases: matchingCases };
      }
    });
    return filtered;
  }

  if (loading) {
    return <div className={styles.loading}>Loading taxonomy...</div>;
  }

  if (!taxonomy) {
    return <div className={styles.error}>Failed to load taxonomy</div>;
  }

  const displayCategories = searchTerm ? filterCases() : taxonomy.categories;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3>Aviation Edge Case Taxonomy</h3>
          <p className={styles.subtitle}>
            {taxonomy.metadata.total_cases} edge cases across {Object.keys(taxonomy.categories).length} categories
          </p>
        </div>
        <div className={styles.meta}>
          <span className={styles.version}>Version {taxonomy.version}</span>
          <span className={styles.updated}>Updated {taxonomy.last_updated}</span>
        </div>
      </div>

      <div className={styles.search}>
        <input
          type="text"
          placeholder="Search edge cases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className={styles.clearButton}>
            Clear
          </button>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.treeView}>
          {Object.entries(displayCategories).map(([categoryKey, category]) => (
            <CategoryNode
              key={categoryKey}
              categoryKey={categoryKey}
              category={category}
              expanded={expandedCategories.has(categoryKey)}
              onToggle={() => toggleCategory(categoryKey)}
              onSelectCase={setSelectedCase}
              selectedCaseId={selectedCase?.id}
            />
          ))}
        </div>

        {selectedCase && (
          <div className={styles.detailsPanel}>
            <CaseDetails edgeCase={selectedCase} onClose={() => setSelectedCase(null)} />
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <h4>Data Sources</h4>
        <ul className={styles.sources}>
          {taxonomy.metadata.sources.map((source, i) => (
            <li key={i}>{source}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CategoryNode({ categoryKey, category, expanded, onToggle, onSelectCase, selectedCaseId }) {
  const severityColor = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#eab308',
    low: '#3b82f6'
  }[category.severity] || '#666';

  return (
    <div className={styles.category}>
      <div className={styles.categoryHeader} onClick={onToggle}>
        <span className={styles.expandIcon}>{expanded ? '▼' : '▶'}</span>
        <span className={styles.categoryName} style={{ color: severityColor }}>
          {category.name}
        </span>
        <span className={styles.caseCount}>{category.cases.length} cases</span>
      </div>

      {expanded && (
        <div className={styles.cases}>
          {category.cases.map((edgeCase) => (
            <div
              key={edgeCase.id}
              className={`${styles.caseItem} ${selectedCaseId === edgeCase.id ? styles.selected : ''}`}
              onClick={() => onSelectCase(edgeCase)}
            >
              <div className={styles.caseHeader}>
                <span className={styles.caseId}>{edgeCase.id}</span>
                <span className={styles.caseName}>{edgeCase.name}</span>
              </div>
              <div className={styles.caseDescription}>{edgeCase.description}</div>
              <div className={styles.caseMeta}>
                <span className={styles.severityBadge} data-severity={getSeverityLevel(edgeCase.severity_score)}>
                  Severity: {edgeCase.severity_score.toFixed(2)}
                </span>
                {edgeCase.keywords && (
                  <span className={styles.keywordCount}>{edgeCase.keywords.length} keywords</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CaseDetails({ edgeCase, onClose }) {
  return (
    <div className={styles.details}>
      <div className={styles.detailsHeader}>
        <div>
          <h4>{edgeCase.name}</h4>
          <p className={styles.caseIdBadge}>{edgeCase.id}</p>
        </div>
        <button onClick={onClose} className={styles.closeButton}>×</button>
      </div>

      <div className={styles.detailsBody}>
        <section>
          <h5>Description</h5>
          <p>{edgeCase.description}</p>
        </section>

        <section>
          <h5>Severity Score</h5>
          <div className={styles.severityDisplay}>
            <div className={styles.severityBar}>
              <div
                className={styles.severityFill}
                style={{ width: `${edgeCase.severity_score * 100}%` }}
                data-severity={getSeverityLevel(edgeCase.severity_score)}
              />
            </div>
            <span className={styles.severityValue}>{edgeCase.severity_score.toFixed(2)}</span>
          </div>
        </section>

        {edgeCase.keywords && edgeCase.keywords.length > 0 && (
          <section>
            <h5>Detection Keywords</h5>
            <div className={styles.tags}>
              {edgeCase.keywords.map((kw, i) => (
                <span key={i} className={styles.tag}>{kw}</span>
              ))}
            </div>
          </section>
        )}

        {edgeCase.phraseology_patterns && (
          <section>
            <h5>Phraseology Patterns</h5>
            <div className={styles.tags}>
              {edgeCase.phraseology_patterns.map((pat, i) => (
                <span key={i} className={styles.tag}>{pat}</span>
              ))}
            </div>
          </section>
        )}

        {edgeCase.detection_rules && (
          <section>
            <h5>Detection Rules</h5>
            <div className={styles.rules}>
              {Object.entries(edgeCase.detection_rules).map(([key, value]) => (
                <div key={key} className={styles.rule}>
                  <strong>{formatRuleName(key)}:</strong> {value}
                </div>
              ))}
            </div>
          </section>
        )}

        {edgeCase.audio_signatures && (
          <section>
            <h5>Audio Signatures</h5>
            <div className={styles.signatures}>
              {Object.entries(edgeCase.audio_signatures).map(([key, value]) => (
                <div key={key} className={styles.signature}>
                  <strong>{formatRuleName(key)}:</strong> {JSON.stringify(value)}
                </div>
              ))}
            </div>
          </section>
        )}

        {edgeCase.references && edgeCase.references.length > 0 && (
          <section>
            <h5>References</h5>
            <ul className={styles.references}>
              {edgeCase.references.map((ref, i) => (
                <li key={i}>{ref}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function formatRuleName(key) {
  return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function getSeverityLevel(score) {
  if (score >= 0.85) return 'critical';
  if (score >= 0.70) return 'high';
  if (score >= 0.50) return 'medium';
  return 'low';
}
