import { resolve } from 'path';
try {
  process.loadEnvFile(resolve(__dirname, '../../../.env'));
} catch (e) {}
