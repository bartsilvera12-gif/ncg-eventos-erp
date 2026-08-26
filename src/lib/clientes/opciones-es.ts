/**
 * Opciones compartidas entre el form de alta y el detalle-edicion de clientes
 * (regimen fiscal y forma de pago). Un solo lugar → los value guardados en DB
 * siempre coinciden con los que muestran los <select>.
 */

export const REGIMEN_FISCAL_OPTS: { value: string; label: string }[] = [
  { value: "",                        label: "— sin definir —" },
  { value: "regimen_general",         label: "Régimen general" },
  { value: "recargo_equivalencia",    label: "Recargo de equivalencia" },
  { value: "regimen_simplificado",    label: "Régimen simplificado (módulos)" },
  { value: "exento_iva",              label: "Exento de IVA (art. 20 LIVA)" },
  { value: "intracomunitario",        label: "Intracomunitario (NIF-IVA)" },
  { value: "extracomunitario",        label: "Extracomunitario / exportación" },
  { value: "inversion_sujeto_pasivo", label: "Inversión del sujeto pasivo (ISP)" },
  { value: "no_sujeto",               label: "No sujeto" },
  { value: "otro",                    label: "Otro" },
];

export const FORMA_PAGO_OPTS: { value: string; label: string }[] = [
  { value: "",              label: "— sin definir —" },
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo",      label: "Efectivo" },
  { value: "tarjeta",       label: "Tarjeta" },
  { value: "cheque",        label: "Cheque" },
  { value: "giro",          label: "Giro / domiciliación" },
  { value: "otro",          label: "Otro" },
];
