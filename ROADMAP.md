# Roadmap & TODOs

Este documento contiene ideas y futuras funcionalidades a implementar en **Postulaciones Fast** para evolucionar el MVP.

## 📋 Tablero Kanban (Drag & Drop)
- [x] Crear una vista de Tablero (tipo Trello).
- [x] Configurar columnas basadas en los estados: `Pendiente`, `Aplicado`, `Entrevista`, `Rechazado`.
- [x] Implementar la funcionalidad de arrastrar y soltar (drag & drop) para actualizar el estado de una postulación fácilmente.

## 🤖 Generador de Cover Letters con IA
- [ ] Integrar la API de IA (Gemini / OpenAI).
- [ ] Crear una funcionalidad que tome el `texto_postulacion` (job description) y el archivo YAML del CV seleccionado (`cv_version`).
- [ ] Generar un borrador automático de Carta de Presentación o mensaje de LinkedIn altamente personalizado.

## 📊 Dashboard y Estadísticas (Analytics)
- [x] Crear un panel superior (o pestaña) con métricas accionables.
- [x] **Embudo de Conversión (El Diagnóstico)**: Mostrar cuántas aplicaciones (`Aplicado`) se convierten en entrevistas (`Entrevista`). Ayuda a saber si falla el CV o las habilidades de entrevista.
- [x] **A/B Testing de CVs (Killer Feature)**: Mostrar la tasa de respuesta/entrevistas agrupada por versión de CV (`cv_version`).
- [x] **Consistencia (Racha)**: Tracking semanal de cuántas postulaciones has enviado vs. un objetivo.
- [x] **Panel de Acción Requerida**: Integrar con el Sistema de Seguimiento (abajo) para mostrar a qué empresas debes mandar email hoy.

## ⏰ Sistema de Seguimiento (Follow-ups)
- [x] Agregar alertas visuales para postulaciones que llevan mucho tiempo (ej. 7-10 días) en estado `Aplicado` sin actualizaciones.
- [x] Crear una sección de "Acción Requerida" para no olvidar contactar a los reclutadores.

## 💰 Tracker de Entrevistas y Salarios
- [ ] Mejorar el modelo de datos o el formulario cuando el estado pasa a `Entrevista`.
- [ ] Agregar campos específicos para:
  - Etapa/Ronda de la entrevista (Técnica, RRHH, Fit).
  - Nombre del entrevistador.
  - Expectativa salarial o salario ofrecido.
- [ ] Permitir comparar diferentes propuestas de forma sencilla.
