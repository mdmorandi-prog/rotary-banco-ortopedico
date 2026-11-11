// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - UNIFIED POSTGRESQL DATA API ROUTE (/api/db)
// Executes real-time database operations against Neon PostgreSQL (rotary schema)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { pgDataService } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, args = [] } = body;

    switch (action) {
      case 'getEquipments':
        return NextResponse.json({ ok: true, data: await pgDataService.getEquipments(args[0]) });
      case 'getEquipmentById':
        return NextResponse.json({ ok: true, data: await pgDataService.getEquipmentById(args[0]) });
      case 'getEquipmentByQrToken':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.getEquipmentByQrToken(args[0]),
        });
      case 'createEquipment':
        return NextResponse.json({ ok: true, data: await pgDataService.createEquipment(args[0]) });
      case 'updateEquipment':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.updateEquipment(args[0], args[1]),
        });

      case 'getBeneficiaries':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.getBeneficiaries(args[0]),
        });
      case 'getBeneficiaryById':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.getBeneficiaryById(args[0]),
        });
      case 'getBeneficiaryByCpf':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.getBeneficiaryByCpf(args[0]),
        });
      case 'createBeneficiary':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.createBeneficiary(args[0]),
        });

      case 'getLoans':
        return NextResponse.json({ ok: true, data: await pgDataService.getLoans(args[0]) });
      case 'getLoanById':
        return NextResponse.json({ ok: true, data: await pgDataService.getLoanById(args[0]) });
      case 'getLoanByMagicToken':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.getLoanByMagicToken(args[0]),
        });
      case 'getActiveLoanByEquipmentId':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.getActiveLoanByEquipmentId(args[0]),
        });
      case 'createLoan':
        return NextResponse.json({ ok: true, data: await pgDataService.createLoan(args[0]) });
      case 'renewLoan':
        return NextResponse.json({ ok: true, data: await pgDataService.renewLoan(args[0]) });
      case 'notifyReturnIntent':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.notifyReturnIntent(args[0], args[1], args[2]),
        });
      case 'returnLoan':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.returnLoan(args[0], args[1]),
        });

      case 'releaseEquipment':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.releaseEquipment(args[0], args[1], args[2]),
        });
      case 'getDashboardMetrics':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.getDashboardMetrics(),
        });
      case 'getLoanEvents':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.getLoanEvents(args[0]),
        });
      case 'addLoanEvent':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.addLoanEvent(args[0]),
        });
      case 'updateLoanGps':
        return NextResponse.json({
          ok: true,
          data: await pgDataService.updateLoanGps(args[0], args[1], args[2], args[3]),
        });

      default:
        return NextResponse.json(
          { ok: false, error: `Ação desconhecida: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error('[POST /api/db] Error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Erro interno no banco de dados PostgreSQL.' },
      { status: 500 }
    );
  }
}

