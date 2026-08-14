/**
 * Los pasos de agregar un disco.
 *
 * Aquí los números SÍ dicen algo cierto: agregar un disco es una secuencia
 * de verdad, con un orden que no se puede alterar —no se puede elegir una
 * edición antes de buscarla, ni revisar antes de elegir. Numerar cosas que
 * no son una secuencia es decoración; numerar esta lo convierte en una tarea
 * con principio y fin en vez de cuatro pantallas sueltas que se sienten
 * sitios distintos.
 *
 * Y responde la pregunta que antes no tenía respuesta: «¿cuánto me falta?».
 */

interface FlowStepsProps {
  /** Los pasos de este camino, en orden. */
  steps: string[]
  /** En cuál se está, empezando por 0. */
  current: number
  /** Salir de la tarea entera. */
  onCancel: () => void
  cancelLabel?: string
}

function FlowSteps({ steps, current, onCancel, cancelLabel = 'Cancelar' }: FlowStepsProps) {
  return (
    <div className="flow-steps">
      <ol className="flow-list">
        {steps.map((step, index) => {
          const estado =
            index < current ? 'hecho' : index === current ? 'actual' : 'pendiente'
          return (
            <li key={step} className={`flow-step flow-${estado}`}>
              {/*
                El paso hecho lleva un visto y no su número: el número ya
                cumplió su función, y lo que interesa saber de él es que está
                resuelto.
              */}
              <span className="flow-num numeric" aria-hidden="true">
                {estado === 'hecho' ? '✓' : index + 1}
              </span>
              <span className="flow-label">{step}</span>
            </li>
          )
        })}
      </ol>

      <button className="btn-link" onClick={onCancel}>
        {cancelLabel}
      </button>
    </div>
  )
}

export default FlowSteps
