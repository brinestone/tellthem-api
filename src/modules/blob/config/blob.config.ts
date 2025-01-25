import { registerAs } from '@nestjs/config';
import { join } from 'path';

export default registerAs('blobConfig', () => {
  const uploadsLocation = join(process.cwd(), 'uploads');
  return {
    uploadsLocation,
  };
});
