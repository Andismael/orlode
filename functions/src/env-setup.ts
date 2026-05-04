/**
 * MUST be the very first import in index.ts
 * Loads .env before any server module initializes
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// From functions/lib/functions/src/ → corpmind-ai root
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });
// From functions/lib/functions/src/ → functions/
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
// Local fallback
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
