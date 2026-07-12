import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
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
            Política de Privacidad
          </h1>
          <p className="text-gray-600 mb-8">
            Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introducción</h2>
              <p>
                En YellowDyeMx, nos comprometemos a proteger su privacidad y garantizar la seguridad de su información personal.
                Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos sus datos personales cuando
                utiliza nuestros servicios de gestión de pedidos y planes alimenticios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Información que Recopilamos</h2>
              <p className="mb-3">Recopilamos la siguiente información personal:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Nombre completo y datos de contacto (correo electrónico, teléfono)</li>
                <li>Dirección de entrega y código postal</li>
                <li>Información de facturación y RFC (si aplica)</li>
                <li>Preferencias alimentarias y restricciones dietéticas</li>
                <li>Historial de pedidos y transacciones</li>
                <li>Información de inicio de sesión y credenciales de acceso</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Uso de la Información</h2>
              <p className="mb-3">Utilizamos su información personal para:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Procesar y gestionar sus pedidos de planes alimenticios</li>
                <li>Comunicarnos con usted sobre sus pedidos y entregas</li>
                <li>Personalizar su experiencia según sus preferencias dietéticas</li>
                <li>Procesar pagos y generar facturas electrónicas</li>
                <li>Mejorar nuestros servicios y productos</li>
                <li>Cumplir con obligaciones legales y fiscales</li>
                <li>Enviar notificaciones importantes sobre nuestros servicios</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Almacenamiento y Seguridad</h2>
              <p>
                Sus datos se almacenan de forma segura en servidores protegidos con cifrado y medidas de seguridad avanzadas.
                Implementamos controles de acceso estrictos y solo el personal autorizado puede acceder a su información personal.
                Utilizamos protocolos de seguridad estándar de la industria, incluyendo cifrado SSL/TLS para todas las transmisiones
                de datos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Compartir Información</h2>
              <p className="mb-3">No vendemos ni alquilamos su información personal a terceros. Podemos compartir su información únicamente con:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Proveedores de servicios de entrega para completar sus pedidos</li>
                <li>Procesadores de pagos para transacciones seguras</li>
                <li>Autoridades fiscales cuando sea requerido por ley</li>
                <li>Proveedores de servicios técnicos que nos ayudan a operar nuestra plataforma</li>
              </ul>
              <p className="mt-3">
                Todos nuestros socios están obligados contractualmente a mantener la confidencialidad de su información.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Sus Derechos</h2>
              <p className="mb-3">Usted tiene derecho a:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Acceder a sus datos personales que tenemos en nuestros registros</li>
                <li>Solicitar la corrección de información incorrecta o desactualizada</li>
                <li>Solicitar la eliminación de sus datos personales (derecho al olvido)</li>
                <li>Oponerse al procesamiento de sus datos personales</li>
                <li>Solicitar la portabilidad de sus datos a otro servicio</li>
                <li>Retirar su consentimiento en cualquier momento</li>
              </ul>
              <p className="mt-3">
                Para ejercer cualquiera de estos derechos, póngase en contacto con nosotros a través de los canales
                de comunicación proporcionados al final de esta política.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Cookies y Tecnologías Similares</h2>
              <p>
                Utilizamos cookies y tecnologías similares para mejorar su experiencia en nuestra plataforma,
                mantener su sesión activa y analizar el uso del sitio. Puede configurar su navegador para rechazar
                cookies, aunque esto puede afectar la funcionalidad de algunos servicios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Retención de Datos</h2>
              <p>
                Conservamos su información personal solo durante el tiempo necesario para cumplir con los fines descritos
                en esta política, a menos que la ley requiera o permita un período de retención más largo. Los datos de
                facturación se conservan según lo exigido por la legislación fiscal mexicana.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Menores de Edad</h2>
              <p>
                Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos intencionalmente información
                personal de menores sin el consentimiento de los padres o tutores legales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Cambios a esta Política</h2>
              <p>
                Nos reservamos el derecho de actualizar esta Política de Privacidad en cualquier momento. Le notificaremos
                sobre cambios significativos publicando la nueva política en esta página y actualizando la fecha de
                "última actualización" en la parte superior.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contacto</h2>
              <p className="mb-3">
                Si tiene preguntas, comentarios o inquietudes sobre esta Política de Privacidad o sobre cómo manejamos
                sus datos personales, puede contactarnos a través de:
              </p>
              <ul className="list-none space-y-2 ml-4">
                <li><strong>Empresa:</strong> YellowDyeMx</li>
                <li><strong>Correo electrónico:</strong> privacidad@yellowdyemx.com</li>
                <li><strong>Responsable de Protección de Datos:</strong> Departamento de Privacidad</li>
              </ul>
            </section>

            <section className="bg-gray-50 p-6 rounded-xl mt-8">
              <p className="text-sm text-gray-600">
                Al utilizar nuestros servicios, usted acepta los términos de esta Política de Privacidad y consiente
                el procesamiento de su información personal según lo descrito anteriormente.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
