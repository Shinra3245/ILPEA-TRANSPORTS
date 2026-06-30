export function normalizarBusqueda(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function coincideBusqueda(
  termino: string,
  ...partes: Array<string | number | null | undefined>
): boolean {
  const normalizado = normalizarBusqueda(termino.trim());
  if (!normalizado) {
    return true;
  }

  const haystack = normalizarBusqueda(partes.map((parte) => String(parte ?? '')).join(' '));
  return haystack.includes(normalizado);
}
