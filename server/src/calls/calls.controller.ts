import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CallsService } from './calls.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('active')
  active() {
    return this.calls.listActive();
  }

  @Patch(':id/handled')
  handled(@Param('id') id: string) {
    return this.calls.markHandled(id);
  }
}
