export const ORDER_PAGE_DEFAULT_TEXTS = {
  stepLabelDuration: 'Duración',
  stepLabelWeek: 'Semana',
  stepLabelPlan: 'Plan',
  stepLabelMenu: 'Menú',
  stepLabelSummary: 'Resumen',
  backButton: 'Atrás',
  continueButton: 'Continuar',
  nextWeekButton: 'Siguiente semana',
  viewSummaryButton: 'Ver resumen',

  durationTitle: 'Duración del Plan',
  durationSubtitle: 'Selecciona cuántas semanas deseas ordenar',
  duration1Label: '1 Semana',
  duration1Description: 'Plan semanal',
  duration2Label: '2 Semanas',
  duration2Description: 'Plan quincenal',
  duration4Label: '4 Semanas',
  duration4Description: 'Plan mensual',
  durationNote: 'Las semanas disponibles se seleccionarán automáticamente.',

  weeksTitle: 'Semanas Seleccionadas',
  weeksSubtitle: 'Haz clic en una semana para ver el menú',
  deliveryDateLabel: 'Fecha de entrega',
  sundayDeliveryHours: 'Entregas de 6:30 a 9:30 PM del domingo',
  mondayDeliveryHours: 'Entregas en lunes a partir de las 10:00 AM',
  switchToMondayLabel: 'Solicitar entrega en lunes',
  switchToSundayLabel: 'Cambiar a entrega en domingo',
  familyTitle: '¿Para quién es este pedido?',
  familySubtitle: 'Selecciona el miembro de la familia',
  familyRestrictionsNote: 'El menú se filtrará automáticamente según estas restricciones',
  nextStepNotice: 'El siguiente paso es seleccionar un plan para la semana con entrega el',

  planTitle: 'Selecciona tu Plan',
  planCardHint: 'Selecciona tus comidas favoritas del menú semanal',

  menuTitle: 'Selecciona tu Menú',
  breakfastDescription: 'Empieza el día con energía',
  lunchDescription: 'El plato fuerte del día',
  dinnerDescription: 'Cierra el día bien nutrido',
  minMealsTitle: 'Completa el mínimo de comidas por semana',
  minMealsDescription: 'Cada semana debe tener al menos 3 comidas principales (Desayuno, Comida o Cena). Las colaciones no cuentan para el mínimo.',
  colacionesTitle: 'Completa las colaciones requeridas',
  colacionesDescription: 'Los planes Fitness y Balance incluyen colaciones. Debes seleccionar el número requerido según tus comidas principales.',

  summaryTitle: 'Resumen del Pedido',
  deliveryOptionRequired: 'Selecciona una opción de entrega para continuar',
  loginPrompt: 'Inicia sesion para agregar al carrito',
  loginButton: 'Iniciar Sesion',
  signupButton: 'Crear Cuenta',
};

export type OrderPageTexts = typeof ORDER_PAGE_DEFAULT_TEXTS;
export type OrderPageTextKey = keyof OrderPageTexts;

export const ORDER_PAGE_DEFAULT_TOGGLES = {
  showMondayDelivery: true,
  showNextStepNotice: true,
  showMinMealsNotice: true,
  showColacionesNotice: true,
};

export type OrderPageToggles = typeof ORDER_PAGE_DEFAULT_TOGGLES;
export type OrderPageToggleKey = keyof OrderPageToggles;

export type OrderPageContent = OrderPageTexts & OrderPageToggles;

export const ORDER_PAGE_DEFAULT_CONTENT: OrderPageContent = {
  ...ORDER_PAGE_DEFAULT_TEXTS,
  ...ORDER_PAGE_DEFAULT_TOGGLES,
};

export function resolveOrderPageContent(raw: unknown): OrderPageContent {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const texts = { ...ORDER_PAGE_DEFAULT_TEXTS };
  for (const key of Object.keys(texts) as OrderPageTextKey[]) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') texts[key] = value;
  }
  const toggles = { ...ORDER_PAGE_DEFAULT_TOGGLES };
  for (const key of Object.keys(toggles) as OrderPageToggleKey[]) {
    if (typeof source[key] === 'boolean') toggles[key] = source[key] as boolean;
  }
  return { ...texts, ...toggles };
}

interface TextField { key: OrderPageTextKey; label: string; multiline?: boolean }
interface ToggleField { key: OrderPageToggleKey; label: string }

export const ORDER_PAGE_EDITOR_SECTIONS: { title: string; texts: TextField[]; toggles?: ToggleField[] }[] = [
  {
    title: 'Pasos y botones',
    texts: [
      { key: 'stepLabelDuration', label: 'Paso 1' },
      { key: 'stepLabelWeek', label: 'Paso 2' },
      { key: 'stepLabelPlan', label: 'Paso 3' },
      { key: 'stepLabelMenu', label: 'Paso 4' },
      { key: 'stepLabelSummary', label: 'Paso 5' },
      { key: 'backButton', label: 'Botón regresar' },
      { key: 'continueButton', label: 'Botón continuar' },
      { key: 'nextWeekButton', label: 'Botón siguiente semana' },
      { key: 'viewSummaryButton', label: 'Botón ver resumen' },
    ],
  },
  {
    title: 'Paso 1: Duración del plan',
    texts: [
      { key: 'durationTitle', label: 'Título' },
      { key: 'durationSubtitle', label: 'Subtítulo' },
      { key: 'duration1Label', label: 'Opción 1 semana - nombre' },
      { key: 'duration1Description', label: 'Opción 1 semana - descripción' },
      { key: 'duration2Label', label: 'Opción 2 semanas - nombre' },
      { key: 'duration2Description', label: 'Opción 2 semanas - descripción' },
      { key: 'duration4Label', label: 'Opción 4 semanas - nombre' },
      { key: 'duration4Description', label: 'Opción 4 semanas - descripción' },
      { key: 'durationNote', label: 'Nota al elegir duración', multiline: true },
    ],
  },
  {
    title: 'Paso 2: Semanas y entrega',
    texts: [
      { key: 'weeksTitle', label: 'Título' },
      { key: 'weeksSubtitle', label: 'Subtítulo' },
      { key: 'deliveryDateLabel', label: 'Etiqueta de fecha de entrega' },
      { key: 'sundayDeliveryHours', label: 'Horario de entrega domingo' },
      { key: 'mondayDeliveryHours', label: 'Horario de entrega lunes' },
      { key: 'switchToMondayLabel', label: 'Enlace para cambiar a lunes' },
      { key: 'switchToSundayLabel', label: 'Enlace para cambiar a domingo' },
      { key: 'familyTitle', label: 'Miembro de la familia - título' },
      { key: 'familySubtitle', label: 'Miembro de la familia - subtítulo' },
      { key: 'familyRestrictionsNote', label: 'Nota de restricciones', multiline: true },
      { key: 'nextStepNotice', label: 'Aviso de siguiente paso (antes de la fecha)', multiline: true },
    ],
    toggles: [
      { key: 'showMondayDelivery', label: 'Mostrar opción de entrega en lunes' },
      { key: 'showNextStepNotice', label: 'Mostrar aviso de siguiente paso' },
    ],
  },
  {
    title: 'Paso 3: Plan',
    texts: [
      { key: 'planTitle', label: 'Título' },
      { key: 'planCardHint', label: 'Texto en cada plan', multiline: true },
    ],
  },
  {
    title: 'Paso 4: Menú',
    texts: [
      { key: 'menuTitle', label: 'Título' },
      { key: 'breakfastDescription', label: 'Descripción de desayuno' },
      { key: 'lunchDescription', label: 'Descripción de comida' },
      { key: 'dinnerDescription', label: 'Descripción de cena' },
      { key: 'minMealsTitle', label: 'Aviso de mínimo de comidas - título' },
      { key: 'minMealsDescription', label: 'Aviso de mínimo de comidas - texto', multiline: true },
      { key: 'colacionesTitle', label: 'Aviso de colaciones - título' },
      { key: 'colacionesDescription', label: 'Aviso de colaciones - texto', multiline: true },
    ],
    toggles: [
      { key: 'showMinMealsNotice', label: 'Mostrar aviso de mínimo de comidas' },
      { key: 'showColacionesNotice', label: 'Mostrar aviso de colaciones' },
    ],
  },
  {
    title: 'Paso 5: Resumen',
    texts: [
      { key: 'summaryTitle', label: 'Título del resumen' },
      { key: 'deliveryOptionRequired', label: 'Aviso de opción de entrega' },
      { key: 'loginPrompt', label: 'Texto para usuarios sin sesión' },
      { key: 'loginButton', label: 'Botón iniciar sesión' },
      { key: 'signupButton', label: 'Botón crear cuenta' },
    ],
  },
];
