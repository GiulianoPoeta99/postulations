import { ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { createPostulacion, deletePostulacion, updatePostulacion } from "@/app/actions";
import { applicationStatuses, listApplications, type Application } from "@/lib/db";

export const dynamic = "force-dynamic";

function statusLabel(status: Application["estado"]) {
  const labels: Record<Application["estado"], string> = {
    aplicado: "Aplicado",
    rechazado: "Rechazado",
    entrevista: "Entrevista"
  };

  return labels[status];
}

export default function Home() {
  const applications = listApplications();

  return (
    <main className="page-shell">
      <section className="workspace">
        <header className="app-header">
          <div>
            <p className="eyebrow">Postulaciones</p>
            <h1>Seguimiento</h1>
          </div>
          <div className="counter" aria-label={`${applications.length} postulaciones`}>
            {applications.length}
          </div>
        </header>

        <form action={createPostulacion} className="create-panel">
          <div className="form-grid">
            <label className="field">
              <span>Empresa</span>
              <input name="nombreEmpresa" placeholder="Nombre empresa" required />
            </label>
            <label className="field">
              <span>Link</span>
              <input name="linkPropuesta" type="url" placeholder="https://..." />
            </label>
            <label className="field">
              <span>Estado</span>
              <select name="estado" defaultValue="aplicado">
                {applicationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field notes-field">
              <span>Notas</span>
              <input name="notas" placeholder="Notas rápidas" />
            </label>
            <button className="primary-button" type="submit">
              <Plus size={16} aria-hidden="true" />
              Agregar
            </button>
          </div>
        </form>

        <div className="table-frame">
          <table>
            <thead>
              <tr>
                <th className="id-col">ID</th>
                <th>Empresa</th>
                <th>Link propuesta</th>
                <th>Estado</th>
                <th>Notas</th>
                <th className="actions-col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={6}>
                    Sin postulaciones
                  </td>
                </tr>
              ) : (
                applications.map((application) => {
                  const updateFormId = `update-${application.id}`;
                  const deleteFormId = `delete-${application.id}`;

                  return (
                    <tr key={application.id}>
                      <td className="id-cell">{application.id}</td>
                      <td>
                        <input
                          className="table-input"
                          defaultValue={application.nombreEmpresa}
                          form={updateFormId}
                          name="nombreEmpresa"
                          required
                        />
                      </td>
                      <td>
                        <div className="link-cell">
                          <input
                            className="table-input"
                            defaultValue={application.linkPropuesta}
                            form={updateFormId}
                            name="linkPropuesta"
                            type="url"
                          />
                          {application.linkPropuesta ? (
                            <a
                              className="icon-link"
                              href={application.linkPropuesta}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Abrir propuesta de ${application.nombreEmpresa}`}
                            >
                              <ExternalLink size={15} aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <select
                          className="table-select"
                          defaultValue={application.estado}
                          form={updateFormId}
                          name="estado"
                        >
                          {applicationStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <textarea
                          className="table-notes"
                          defaultValue={application.notas}
                          form={updateFormId}
                          name="notas"
                          rows={2}
                        />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-button" form={updateFormId} type="submit" title="Guardar">
                            <Save size={16} aria-hidden="true" />
                            <span className="sr-only">Guardar</span>
                          </button>
                          <button className="icon-button danger" form={deleteFormId} type="submit" title="Borrar">
                            <Trash2 size={16} aria-hidden="true" />
                            <span className="sr-only">Borrar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {applications.map((application) => (
          <form
            action={updatePostulacion.bind(null, application.id)}
            id={`update-${application.id}`}
            key={`update-form-${application.id}`}
          />
        ))}
        {applications.map((application) => (
          <form
            action={deletePostulacion.bind(null, application.id)}
            id={`delete-${application.id}`}
            key={`delete-form-${application.id}`}
          />
        ))}
      </section>
    </main>
  );
}
