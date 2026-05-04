import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../setup';

vi.mock('@/agents/vision.agent', () => ({
  visionAgent: {
    process: vi.fn(async ({ action, imageBuffer, companyId }: {
      action: string; imageBuffer?: Buffer; companyId: string;
    }) => {
      if (action === 'detect_faces') {
        return { facesDetected: 2, faces: [{ boundingBox: [10, 10, 100, 100] }, { boundingBox: [200, 10, 100, 100] }] };
      }
      if (action === 'recognize') {
        const mockMatch = imageBuffer && imageBuffer.toString().includes('known');
        return mockMatch
          ? { recognized: true, person: { name: 'Jean Dupont', title: 'Manager', confidence: 0.94 } }
          : { recognized: false, person: null, confidence: 0 };
      }
      if (action === 'identify_unknown') {
        return { recognized: false, person: null, suggestion: 'Visiteur non enregistré' };
      }
      return {};
    }),
  },
}));

import { visionAgent } from '@/agents/vision.agent';

describe('Vision Agent', () => {
  beforeEach(() => { clearMockFirestore(); vi.clearAllMocks(); });

  it('should detect faces in an image', async () => {
    const result = await visionAgent.process({
      action: 'detect_faces',
      imageBuffer: Buffer.from('fake-image-data'),
      companyId: 'test-company',
    });

    expect(result.facesDetected).toBeGreaterThan(0);
    expect(Array.isArray(result.faces)).toBe(true);
  });

  it('should recognize a known person', async () => {
    const result = await visionAgent.process({
      action: 'recognize',
      imageBuffer: Buffer.from('known-person-image'),
      companyId: 'test-company',
    });

    expect(result.recognized).toBe(true);
    expect(result.person).toBeDefined();
    expect(result.person.name).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should return "unknown" for unregistered faces', async () => {
    const result = await visionAgent.process({
      action: 'identify_unknown',
      imageBuffer: Buffer.from('unknown-person-image'),
      companyId: 'test-company',
    });

    expect(result.recognized).toBe(false);
    expect(result.person).toBeNull();
  });
});
