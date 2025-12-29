/**
 * Content Analysis Service
 * Analyzes transcription content for aviation communication patterns
 */
export class ContentAnalyzer {
  constructor(taxonomy) {
    this.taxonomy = taxonomy;
  }

  /**
   * Analyze transcription for edge cases
   * @param {Object} transcription - Transcription result from STT
   * @param {Object} audioAnalysis - Audio analysis result
   * @returns {ContentAnalysisResult}
   */
  analyze(transcription, audioAnalysis) {
    const text = transcription.text.toLowerCase();
    const words = transcription.words || [];

    return {
      keywords: this._detectKeywords(text),
      phraseologyIssues: this._detectPhraseologyIssues(text, words),
      readbackErrors: this._detectReadbackErrors(transcription),
      emergencyIndicators: this._detectEmergencyIndicators(text, audioAnalysis),
      communicationQuality: this._assessCommunicationQuality(transcription, audioAnalysis),
      speakerPatterns: this._analyzeSpeakerPatterns(transcription)
    };
  }

  /**
   * Detect keywords from taxonomy
   */
  _detectKeywords(text) {
    const detected = [];

    // Iterate through all categories and cases in taxonomy
    for (const [categoryKey, category] of Object.entries(this.taxonomy.categories)) {
      for (const edgeCase of category.cases) {
        if (!edgeCase.keywords) continue;

        const matchedKeywords = edgeCase.keywords.filter(keyword =>
          text.includes(keyword.toLowerCase())
        );

        if (matchedKeywords.length > 0) {
          detected.push({
            caseId: edgeCase.id,
            caseName: edgeCase.name,
            category: categoryKey,
            matchedKeywords,
            severity: edgeCase.severity_score,
            confidence: matchedKeywords.length / edgeCase.keywords.length
          });
        }
      }
    }

    return detected;
  }

  /**
   * Detect phraseology issues
   */
  _detectPhraseologyIssues(text, words) {
    const issues = [];

    // Non-standard terminology
    const casualTerms = ['yeah', 'yep', 'nope', 'okay', 'ok', 'sure', 'thanks', 'uh'];
    const foundCasual = casualTerms.filter(term => text.includes(term));
    if (foundCasual.length > 0) {
      issues.push({
        type: 'non_standard_terminology',
        terms: foundCasual,
        severity: 0.5
      });
    }

    // Missing callsign indicators
    const hasCallsign = this._hasCallsignPattern(text);
    if (!hasCallsign && words.length > 3) {
      issues.push({
        type: 'missing_callsign',
        severity: 0.65
      });
    }

    // Excessive verbosity (>50 words for typical transmission)
    if (words.length > 50) {
      issues.push({
        type: 'excessive_verbosity',
        wordCount: words.length,
        severity: 0.4
      });
    }

    // Homophone confusion potential
    const homophoneRisks = this._detectHomophoneRisks(text);
    if (homophoneRisks.length > 0) {
      issues.push({
        type: 'homophone_confusion_risk',
        risks: homophoneRisks,
        severity: 0.7
      });
    }

    return issues;
  }

  /**
   * Detect potential readback errors
   */
  _detectReadbackErrors(transcription) {
    const errors = [];
    const text = transcription.text.toLowerCase();
    const segments = transcription.segments || [];

    // If we have speaker segments, analyze for readback mismatches
    if (segments.length >= 2) {
      for (let i = 0; i < segments.length - 1; i++) {
        const controllerSegment = segments[i].text.toLowerCase();
        const pilotSegment = segments[i + 1].text.toLowerCase();

        // Extract numbers from both segments
        const controllerNumbers = this._extractNumbers(controllerSegment);
        const pilotNumbers = this._extractNumbers(pilotSegment);

        // Check for number mismatches (potential readback error)
        if (controllerNumbers.length > 0 && pilotNumbers.length > 0) {
          const mismatches = controllerNumbers.filter(num =>
            !pilotNumbers.includes(num)
          );

          if (mismatches.length > 0) {
            errors.push({
              type: 'number_mismatch',
              controllerNumbers,
              pilotNumbers,
              mismatches,
              severity: 0.9,
              segments: [i, i + 1]
            });
          }
        }
      }
    }

    // Detect missing readback (clearance without acknowledgment)
    const clearanceKeywords = ['cleared to land', 'cleared for takeoff', 'hold short', 'cross runway'];
    const hasReadback = text.includes('roger') || text.includes('wilco') || text.includes('affirm');

    for (const clearance of clearanceKeywords) {
      if (text.includes(clearance) && !hasReadback) {
        errors.push({
          type: 'missing_readback',
          clearance,
          severity: 0.85
        });
      }
    }

    return errors;
  }

  /**
   * Detect emergency indicators
   */
  _detectEmergencyIndicators(text, audioAnalysis) {
    const indicators = [];

    // Mayday/Pan-Pan
    if (text.includes('mayday')) {
      indicators.push({
        type: 'mayday',
        severity: 1.0,
        priority: 'critical'
      });
    }

    if (text.includes('pan pan') || text.includes('pan-pan')) {
      indicators.push({
        type: 'pan_pan',
        severity: 0.9,
        priority: 'urgent'
      });
    }

    // Fuel emergencies
    const fuelTerms = ['minimum fuel', 'emergency fuel', 'fuel critical'];
    for (const term of fuelTerms) {
      if (text.includes(term)) {
        indicators.push({
          type: 'fuel_emergency',
          term,
          severity: 0.9,
          priority: 'urgent'
        });
      }
    }

    // System failures
    const failures = ['engine failure', 'engine out', 'fire', 'smoke'];
    for (const failure of failures) {
      if (text.includes(failure)) {
        indicators.push({
          type: 'system_failure',
          failure,
          severity: 0.95,
          priority: 'critical'
        });
      }
    }

    // Urgent tone in audio
    if (audioAnalysis.volumeVariance > 15) {
      indicators.push({
        type: 'urgent_tone_detected',
        severity: 0.7,
        priority: 'medium',
        evidence: 'high_volume_variance'
      });
    }

    return indicators;
  }

  /**
   * Assess communication quality
   */
  _assessCommunicationQuality(transcription, audioAnalysis) {
    let score = 1.0;
    const issues = [];

    // Low transcription confidence
    if (transcription.confidence < 0.7) {
      score -= 0.2;
      issues.push('low_transcription_confidence');
    }

    // Low speech density (lots of silence)
    if (audioAnalysis.speechDensity < 0.5) {
      score -= 0.1;
      issues.push('low_speech_density');
    }

    // High volume variance (stressed/overlapping speech)
    if (audioAnalysis.volumeVariance > 15) {
      score -= 0.15;
      issues.push('high_volume_variance');
    }

    // Overlapping transmissions
    if (audioAnalysis.overlappingTransmissions.detected) {
      score -= 0.2;
      issues.push('overlapping_transmissions');
    }

    return {
      score: Math.max(0, score),
      issues,
      clarity: transcription.confidence,
      audioQuality: 1 - (audioAnalysis.volumeVariance / 30) // Normalize to 0-1
    };
  }

  /**
   * Analyze speaker patterns
   */
  _analyzeSpeakerPatterns(transcription) {
    const speakerCount = transcription.speakerCount || 0;
    const segments = transcription.segments || [];

    // Calculate average words per speaker turn
    const avgWordsPerTurn = segments.length > 0
      ? segments.reduce((sum, seg) => sum + (seg.words?.length || 0), 0) / segments.length
      : 0;

    // Detect rapid back-and-forth (high workload indicator)
    const rapidExchanges = segments.filter((seg, i) => {
      if (i === 0) return false;
      const prevSeg = segments[i - 1];
      return (seg.start - prevSeg.end) < 0.5; // Less than 0.5s gap
    }).length;

    return {
      speakerCount,
      totalTurns: segments.length,
      avgWordsPerTurn,
      rapidExchanges,
      isHighWorkload: rapidExchanges > 3 || avgWordsPerTurn > 30
    };
  }

  /**
   * Helper: Check for callsign pattern
   */
  _hasCallsignPattern(text) {
    // Common airline callsigns
    const airlines = ['united', 'american', 'delta', 'southwest', 'jetblue', 'alaska', 'spirit'];
    const hasAirline = airlines.some(airline => text.includes(airline));

    // General aviation pattern (N-number)
    const hasNNumber = /\bn\s*\d{1,5}\s*[a-z]{1,3}?\b/i.test(text);

    // Military callsigns
    const hasMilitary = /\b(air force|navy|marine|coast guard|army)\s*\d+\b/i.test(text);

    return hasAirline || hasNNumber || hasMilitary;
  }

  /**
   * Helper: Extract numbers from text
   */
  _extractNumbers(text) {
    const numbers = [];
    const matches = text.match(/\d+/g);
    if (matches) {
      numbers.push(...matches.map(n => parseInt(n, 10)));
    }
    return numbers;
  }

  /**
   * Helper: Detect homophone confusion risks
   */
  _detectHomophoneRisks(text) {
    const risks = [];
    const homophones = {
      'to/two': ['to', 'two'],
      'for/four': ['for', 'four'],
      'five/nine': ['five', 'nine']
    };

    for (const [key, words] of Object.entries(homophones)) {
      if (words.some(word => text.includes(word))) {
        risks.push(key);
      }
    }

    return risks;
  }
}
