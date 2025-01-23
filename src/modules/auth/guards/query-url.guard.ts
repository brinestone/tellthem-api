import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class QueryUrlGuard extends AuthGuard('query-url') {}
