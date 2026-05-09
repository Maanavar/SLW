import { config } from 'dotenv';
import path from 'node:path';

// Load backend/.env so DATABASE_URL and other secrets are available in process.env
config({ path: path.resolve(__dirname, '../.env') });
