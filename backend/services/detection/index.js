/**
 * Edge Case Detection Service
 * Multi-modal aviation communication analysis
 */

export { EdgeCaseDetector } from './EdgeCaseDetector.js';
export { AudioAnalyzer } from './AudioAnalyzer.js';
export { ContentAnalyzer } from './ContentAnalyzer.js';

// Example usage:
// import { EdgeCaseDetector } from './services/detection';
//
// const detector = new EdgeCaseDetector({ mode: 'hybrid' });
// await detector.initialize();
//
// const result = await detector.detect('path/to/audio.mp3');
// console.log(result.edgeCaseScore, result.flagged, result.detectedEdgeCases);
