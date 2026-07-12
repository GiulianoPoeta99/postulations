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
- [ ] Crear una sección de métricas o resumen en la pantalla principal.
- [ ] Mostrar gráficos de tasa de conversión (cuántas aplicaciones llegan a entrevista).
- [ ] Mostrar total de postulaciones por semana/mes.
- [ ] Mostrar distribución actual de postulaciones por estado.

## ⏰ Sistema de Seguimiento (Follow-ups)
- [ ] Agregar alertas visuales para postulaciones que llevan mucho tiempo (ej. 7-10 días) en estado `Aplicado` sin actualizaciones.
- [ ] Crear una sección de "Acción Requerida" para no olvidar contactar a los reclutadores.

## 💰 Tracker de Entrevistas y Salarios
- [ ] Mejorar el modelo de datos o el formulario cuando el estado pasa a `Entrevista`.
- [ ] Agregar campos específicos para:
  - Etapa/Ronda de la entrevista (Técnica, RRHH, Fit).
  - Nombre del entrevistador.
  - Expectativa salarial o salario ofrecido.
- [ ] Permitir comparar diferentes propuestas de forma sencilla.
