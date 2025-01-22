import * as campaignSchema from './campaigns';
import * as categorySchema from './categories';
import * as financeSchema from './finance';
import * as userSchema from './users';

export const schema = {
  ...userSchema,
  ...categorySchema,
  ...financeSchema,
  ...campaignSchema,
};
