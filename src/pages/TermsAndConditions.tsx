import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsAndConditions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Regresar</span>
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Términos y Condiciones
          </h1>
          <p className="text-gray-600 mb-8">
            Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Aceptación de los Términos</h2>
              <p>
                Al acceder y utilizar los servicios de YellowDyeMx, usted acepta estar sujeto a estos Términos y Condiciones,
                todas las leyes y regulaciones aplicables, y acepta que es responsable del cumplimiento de las leyes locales
                aplicables. Si no está de acuerdo con alguno de estos términos, tiene prohibido usar o acceder a este sitio
                y sus servicios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Descripción del Servicio</h2>
              <p>
                YellowDyeMx proporciona una plataforma de gestión de pedidos para planes alimenticios personalizados,
                incluyendo la preparación, empaque y entrega de comidas según las preferencias y restricciones dietéticas
                de nuestros clientes. Nuestros servicios incluyen:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                <li>Planes alimenticios personalizados</li>
                <li>Preparación de comidas frescas</li>
                <li>Servicio de entrega a domicilio</li>
                <li>Gestión de pedidos y facturación</li>
                <li>Soporte al cliente</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Registro y Cuenta de Usuario</h2>
              <p className="mb-3">
                Para utilizar nuestros servicios, debe crear una cuenta proporcionando información precisa y completa.
                Usted es responsable de:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Mantener la confidencialidad de su contraseña y credenciales de acceso</li>
                <li>Todas las actividades que ocurran bajo su cuenta</li>
                <li>Notificarnos inmediatamente sobre cualquier uso no autorizado de su cuenta</li>
                <li>Asegurarse de que la información de su cuenta sea precisa y esté actualizada</li>
              </ul>
              <p className="mt-3">
                Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Pedidos y Pagos</h2>
              <p className="mb-3">Al realizar un pedido, usted acepta que:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Todos los pedidos están sujetos a disponibilidad y confirmación del precio</li>
                <li>Los precios mostrados son en pesos mexicanos (MXN) e incluyen IVA cuando aplique</li>
                <li>El pago debe completarse antes de la preparación y entrega del pedido</li>
                <li>Aceptamos diversos métodos de pago, incluyendo tarjetas y transferencias bancarias</li>
                <li>Nos reservamos el derecho de rechazar o cancelar pedidos por razones legítimas</li>
                <li>Las facturas electrónicas se generarán según lo solicitado y conforme a la legislación fiscal vigente</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Política de Cancelación y Reembolsos</h2>
              <p className="mb-3">
                Entendemos que pueden surgir imprevistos. Nuestra política de cancelación es la siguiente:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Puede cancelar pedidos sin cargo hasta 48 horas antes de la entrega programada</li>
                <li>Cancelaciones con menos de 48 horas de anticipación pueden estar sujetas a un cargo del 50%</li>
                <li>No se permiten cancelaciones una vez que el pedido esté en preparación o en ruta de entrega</li>
                <li>Los reembolsos se procesarán dentro de 5-10 días hábiles al método de pago original</li>
                <li>En caso de problemas de calidad o errores en el pedido, contáctenos dentro de las 24 horas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Entregas</h2>
              <p className="mb-3">Respecto al servicio de entrega:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Las entregas se realizan en las zonas geográficas especificadas en nuestra plataforma</li>
                <li>Los horarios de entrega son estimados y pueden variar debido a circunstancias imprevistas</li>
                <li>Debe proporcionar una dirección de entrega precisa y accesible</li>
                <li>Si no hay nadie disponible para recibir el pedido, nos pondremos en contacto con usted</li>
                <li>No somos responsables por pérdidas o daños después de una entrega exitosa</li>
                <li>Los cargos de entrega varían según la zona y se especifican antes de confirmar el pedido</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Restricciones Dietéticas y Alergias</h2>
              <p>
                Hacemos todo lo posible por acomodar restricciones dietéticas y alergias alimentarias. Sin embargo,
                al trabajar con múltiples ingredientes, no podemos garantizar la ausencia absoluta de alérgenos.
                Es responsabilidad del cliente informar claramente sobre cualquier alergia grave y evaluar el riesgo.
                YellowDyeMx no se hace responsable por reacciones alérgicas si la información proporcionada fue
                incorrecta o incompleta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Propiedad Intelectual</h2>
              <p>
                Todo el contenido de nuestra plataforma, incluyendo textos, gráficos, logos, imágenes, recetas y software,
                es propiedad de YellowDyeMx o de sus proveedores de contenido y está protegido por las leyes de propiedad
                intelectual mexicanas e internacionales. No se permite el uso, reproducción o distribución no autorizada
                de nuestro contenido.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitación de Responsabilidad</h2>
              <p className="mb-3">
                En la medida permitida por la ley:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>YellowDyeMx no será responsable por daños indirectos, incidentales o consecuentes</li>
                <li>Nuestra responsabilidad total no excederá el monto pagado por el servicio en cuestión</li>
                <li>No garantizamos que el servicio esté libre de errores o interrupciones</li>
                <li>No somos responsables por problemas causados por fuerza mayor o circunstancias fuera de nuestro control</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Conducta del Usuario</h2>
              <p className="mb-3">Usted acepta NO:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Usar el servicio para fines ilegales o no autorizados</li>
                <li>Intentar acceder a áreas restringidas de nuestra plataforma</li>
                <li>Interferir con el funcionamiento normal del servicio</li>
                <li>Cargar contenido malicioso o dañino</li>
                <li>Acosar, amenazar o difamar a otros usuarios o al personal</li>
                <li>Violar los derechos de propiedad intelectual de terceros</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Modificaciones del Servicio</h2>
              <p>
                Nos reservamos el derecho de modificar, suspender o discontinuar cualquier parte de nuestros servicios
                en cualquier momento, con o sin previo aviso. No seremos responsables ante usted ni ante terceros por
                cualquier modificación, suspensión o discontinuación del servicio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Jurisdicción y Ley Aplicable</h2>
              <p>
                Estos Términos y Condiciones se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier disputa
                relacionada con estos términos se someterá a la jurisdicción exclusiva de los tribunales competentes
                en México.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Divisibilidad</h2>
              <p>
                Si alguna disposición de estos términos se considera inválida o inaplicable, las disposiciones restantes
                continuarán en pleno vigor y efecto.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Modificaciones a los Términos</h2>
              <p>
                Nos reservamos el derecho de actualizar estos Términos y Condiciones en cualquier momento. Los cambios
                entrarán en vigor inmediatamente después de su publicación en esta página. Es su responsabilidad revisar
                estos términos periódicamente. El uso continuado de nuestros servicios después de cambios constituye
                su aceptación de los nuevos términos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contacto</h2>
              <p className="mb-3">
                Si tiene preguntas sobre estos Términos y Condiciones, puede contactarnos a través de:
              </p>
              <ul className="list-none space-y-2 ml-4">
                <li><strong>Empresa:</strong> YellowDyeMx</li>
                <li><strong>Correo electrónico:</strong> soporte@yellowdyemx.com</li>
                <li><strong>Departamento Legal:</strong> legal@yellowdyemx.com</li>
              </ul>
            </section>

            <section className="bg-gray-50 p-6 rounded-xl mt-8">
              <p className="text-sm text-gray-600">
                Al utilizar los servicios de YellowDyeMx, usted reconoce que ha leído, entendido y acepta estar sujeto
                a estos Términos y Condiciones en su totalidad.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
