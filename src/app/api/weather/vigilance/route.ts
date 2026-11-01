import { NextRequest, NextResponse } from 'next/server';
import { getDepartmentVigilance, extractDepartmentCode } from '@/lib/services/meteoFranceService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deptParam = searchParams.get('dept');
    const postcodeParam = searchParams.get('postcode');
    const nameParam = searchParams.get('name');

    const departmentCode = deptParam
      ? deptParam.trim().toUpperCase()
      : extractDepartmentCode(postcodeParam || undefined, nameParam || undefined);

    const report = await getDepartmentVigilance(departmentCode);

    return NextResponse.json(report, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300',
      },
    });
  } catch (error: any) {
    console.error('Erreur API route /api/weather/vigilance:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la vigilance Météo-France' },
      { status: 500 }
    );
  }
}
