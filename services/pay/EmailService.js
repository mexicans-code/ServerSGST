import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

export const enviarBoleto = async (datosReserva) => {
    const { email, nombre, id_reserva, id_pago, tipo, experiencia, hosteleria, fecha_inicio, fecha_fin, total, reservationId, personas, participantes, punto_encuentro, hora } = datosReserva;

    let htmlEmail;

    if (tipo === 'tourism') {
        // ============= EMAIL PARA TURISMO =============
        htmlEmail = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6; 
                        color: #1a1a1a;
                        background: #f5f5f5;
                        padding: 20px;
                    }
                    .email-wrapper { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background: white;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    }
                    .header { 
                        background: linear-gradient(135deg, #87CEEB 0%, #4a90e2 100%);
                        color: white; 
                        padding: 40px 30px;
                        text-align: center;
                    }
                    .header h1 { 
                        font-size: 28px; 
                        font-weight: 700;
                        margin-bottom: 8px;
                        letter-spacing: -0.5px;
                    }
                    .header p { 
                        font-size: 16px; 
                        opacity: 0.95;
                        font-weight: 300;
                    }
                    .content { 
                        padding: 40px 30px;
                    }
                    .reservation-code {
                        background: linear-gradient(135deg, #87CEEB 0%, #4a90e2 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 12px;
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .reservation-code .label {
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        opacity: 0.9;
                        margin-bottom: 8px;
                    }
                    .reservation-code .code {
                        font-size: 24px;
                        font-weight: 700;
                        letter-spacing: 2px;
                        font-family: 'Courier New', monospace;
                    }
                    .property-card {
                        background: #f8f9fa;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 30px;
                    }
                    .property-header {
                        margin-bottom: 15px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid #e9ecef;
                    }
                    .property-name {
                        font-size: 22px;
                        font-weight: 700;
                        color: #2C3E50;
                        margin-bottom: 8px;
                    }
                    .property-location {
                        color: #6c757d;
                        font-size: 14px;
                    }
                    .info-grid {
                        display: table;
                        width: 100%;
                        margin: 20px 0;
                    }
                    .info-item {
                        display: table-row;
                    }
                    .info-label {
                        display: table-cell;
                        padding: 12px 0;
                        font-size: 14px;
                        color: #6c757d;
                        width: 40%;
                    }
                    .info-value {
                        display: table-cell;
                        padding: 12px 0;
                        font-size: 14px;
                        font-weight: 600;
                        color: #2C3E50;
                        text-align: right;
                    }
                    .total-section {
                        background: linear-gradient(135deg, #2C3E50 0%, #3d5a80 100%);
                        color: white;
                        padding: 25px;
                        border-radius: 12px;
                        text-align: center;
                        margin: 30px 0;
                    }
                    .total-label {
                        font-size: 14px;
                        opacity: 0.9;
                        margin-bottom: 8px;
                    }
                    .total-amount {
                        font-size: 36px;
                        font-weight: 700;
                        letter-spacing: -1px;
                    }
                    .qr-section {
                        background: white;
                        border: 2px dashed #dee2e6;
                        border-radius: 12px;
                        padding: 30px;
                        text-align: center;
                        margin: 30px 0;
                    }
                    .qr-section p {
                        color: #6c757d;
                        margin-bottom: 15px;
                        font-size: 14px;
                    }
                    .qr-section img {
                        border-radius: 8px;
                        background: white;
                        padding: 10px;
                    }
                    .info-box {
                        background: #e6f2ff;
                        border-left: 4px solid #87CEEB;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                    }
                    .info-box-title {
                        font-weight: 700;
                        color: #2C3E50;
                        margin-bottom: 12px;
                        font-size: 15px;
                    }
                    .info-box ul {
                        margin: 0;
                        padding-left: 20px;
                    }
                    .info-box li {
                        margin: 8px 0;
                        color: #495057;
                        font-size: 14px;
                    }
                    .footer {
                        background: #f8f9fa;
                        padding: 30px;
                        text-align: center;
                        border-top: 1px solid #dee2e6;
                    }
                    .contact-info {
                        margin: 15px 0;
                    }
                    .contact-item {
                        display: inline-block;
                        margin: 0 15px;
                        color: #6c757d;
                        font-size: 13px;
                    }
                    .copyright {
                        margin-top: 20px;
                        color: #adb5bd;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <div class="header">
                        <h1>¡Experiencia Reservada!</h1>
                        <p>Hola ${nombre}, tu reserva está confirmada</p>
                    </div>
                    
                    <div class="content">
                        <div class="reservation-code">
                            <div class="label">Código de Reserva</div>
                            <div class="code">${reservationId}</div>
                        </div>

                        <div class="property-card">
                            <div class="property-header">
                                <div class="property-name">${experiencia?.nombre || 'Experiencia'}</div>
                                <div class="property-location">📍 ${experiencia?.ubicacion || 'Por confirmar'}</div>
                            </div>

                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-label">Fecha</div>
                                    <div class="info-value">${fecha_inicio ? new Date(fecha_inicio).toLocaleDateString('es-ES') : 'Por confirmar'}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Hora</div>
                                    <div class="info-value">${hora || 'Por confirmar'}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Participantes</div>
                                    <div class="info-value">${participantes || personas || 1} ${participantes > 1 ? 'personas' : 'persona'}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Punto de Encuentro</div>
                                    <div class="info-value" style="text-align: right; font-size: 12px;">${punto_encuentro || 'Se informará después'}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">ID Reserva</div>
                                    <div class="info-value">#${id_reserva}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">ID Transacción</div>
                                    <div class="info-value">#${id_pago}</div>
                                </div>
                            </div>
                        </div>

                        <div class="total-section">
                            <div class="total-label">Total Pagado</div>
                            <div class="total-amount">$${total.toFixed(2)}</div>
                            <div style="font-size: 13px; opacity: 0.9; margin-top: 5px;">MXN</div>
                        </div>

                        <div class="qr-section">
                            <p><strong>Código QR de tu reserva</strong></p>
                            <p style="font-size: 13px;">Presenta este código al momento de la experiencia</p>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${reservationId}" alt="QR Code" />
                        </div>

                        <div class="info-box">
                            <div class="info-box-title">⏰ Información Importante</div>
                            <ul>
                                <li><strong>Hora:</strong> Llega 15 minutos antes</li>
                                <li><strong>Punto de encuentro:</strong> ${punto_encuentro || 'Se informará en confirmación'}</li>
                                <li><strong>Identificación:</strong> Requerida</li>
                                <li><strong>Confirmación:</strong> Guarda este correo para tu registro</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p style="font-weight: 600; color: #2C3E50; margin-bottom: 10px;">¿Necesitas ayuda?</p>
                        <div class="contact-info">
                            <span class="contact-item">📞 +52 55 1234 5678</span>
                            <span class="contact-item">📧 soporte@reservas.com</span>
                        </div>
                        <div class="copyright">
                            © 2025 Tu Plataforma de Reservas. Todos los derechos reservados.
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
    } else {
        // ============= EMAIL PARA HOSTELERÍA =============
        const checkin = new Date(fecha_inicio);
        const checkout = new Date(fecha_fin);
        const noches = Math.ceil((checkout - checkin) / (1000 * 60 * 60 * 24));

        htmlEmail = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6; 
                        color: #1a1a1a;
                        background: #f5f5f5;
                        padding: 20px;
                    }
                    .email-wrapper { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background: white;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    }
                    .header { 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; 
                        padding: 40px 30px;
                        text-align: center;
                    }
                    .header h1 { 
                        font-size: 28px; 
                        font-weight: 700;
                        margin-bottom: 8px;
                        letter-spacing: -0.5px;
                    }
                    .header p { 
                        font-size: 16px; 
                        opacity: 0.95;
                        font-weight: 300;
                    }
                    .content { 
                        padding: 40px 30px;
                    }
                    .reservation-code {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 12px;
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .reservation-code .label {
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        opacity: 0.9;
                        margin-bottom: 8px;
                    }
                    .reservation-code .code {
                        font-size: 24px;
                        font-weight: 700;
                        letter-spacing: 2px;
                        font-family: 'Courier New', monospace;
                    }
                    .property-card {
                        background: #f8f9fa;
                        border-radius: 12px;
                        padding: 20px;
                        margin-bottom: 30px;
                    }
                    .property-header {
                        margin-bottom: 15px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid #e9ecef;
                    }
                    .property-name {
                        font-size: 22px;
                        font-weight: 700;
                        color: #2C3E50;
                        margin-bottom: 8px;
                    }
                    .property-location {
                        color: #6c757d;
                        font-size: 14px;
                    }
                    .dates-section {
                        display: table;
                        width: 100%;
                        margin: 20px 0;
                    }
                    .date-block {
                        display: table-cell;
                        width: 50%;
                        padding: 15px;
                        text-align: center;
                    }
                    .date-block:first-child {
                        border-right: 2px solid #dee2e6;
                    }
                    .date-label {
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        color: #6c757d;
                        margin-bottom: 8px;
                    }
                    .date-value {
                        font-size: 16px;
                        font-weight: 600;
                        color: #2C3E50;
                    }
                    .date-day {
                        font-size: 13px;
                        color: #6c757d;
                        margin-top: 4px;
                    }
                    .nights-badge {
                        background: #667eea;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 20px;
                        display: inline-block;
                        font-size: 13px;
                        font-weight: 600;
                        margin-top: 15px;
                    }
                    .info-grid {
                        display: table;
                        width: 100%;
                        margin: 20px 0;
                    }
                    .info-item {
                        display: table-row;
                    }
                    .info-label {
                        display: table-cell;
                        padding: 12px 0;
                        font-size: 14px;
                        color: #6c757d;
                        width: 40%;
                    }
                    .info-value {
                        display: table-cell;
                        padding: 12px 0;
                        font-size: 14px;
                        font-weight: 600;
                        color: #2C3E50;
                        text-align: right;
                    }
                    .total-section {
                        background: linear-gradient(135deg, #2C3E50 0%, #3d5a80 100%);
                        color: white;
                        padding: 25px;
                        border-radius: 12px;
                        text-align: center;
                        margin: 30px 0;
                    }
                    .total-label {
                        font-size: 14px;
                        opacity: 0.9;
                        margin-bottom: 8px;
                    }
                    .total-amount {
                        font-size: 36px;
                        font-weight: 700;
                        letter-spacing: -1px;
                    }
                    .qr-section {
                        background: white;
                        border: 2px dashed #dee2e6;
                        border-radius: 12px;
                        padding: 30px;
                        text-align: center;
                        margin: 30px 0;
                    }
                    .qr-section p {
                        color: #6c757d;
                        margin-bottom: 15px;
                        font-size: 14px;
                    }
                    .qr-section img {
                        border-radius: 8px;
                        background: white;
                        padding: 10px;
                    }
                    .info-box {
                        background: #fff9e6;
                        border-left: 4px solid #ffc107;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                    }
                    .info-box-title {
                        font-weight: 700;
                        color: #2C3E50;
                        margin-bottom: 12px;
                        font-size: 15px;
                    }
                    .info-box ul {
                        margin: 0;
                        padding-left: 20px;
                    }
                    .info-box li {
                        margin: 8px 0;
                        color: #495057;
                        font-size: 14px;
                    }
                    .footer {
                        background: #f8f9fa;
                        padding: 30px;
                        text-align: center;
                        border-top: 1px solid #dee2e6;
                    }
                    .contact-info {
                        margin: 15px 0;
                    }
                    .contact-item {
                        display: inline-block;
                        margin: 0 15px;
                        color: #6c757d;
                        font-size: 13px;
                    }
                    .copyright {
                        margin-top: 20px;
                        color: #adb5bd;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <div class="header">
                        <h1>¡Reserva Confirmada!</h1>
                        <p>Hola ${nombre}, tu reserva está lista</p>
                    </div>
                    
                    <div class="content">
                        <div class="reservation-code">
                            <div class="label">Código de Reserva</div>
                            <div class="code">${reservationId}</div>
                        </div>

                        <div class="property-card">
                            <div class="property-header">
                                <div class="property-name">${hosteleria?.nombre || 'Propiedad'}</div>
                                <div class="property-location">📍 ${hosteleria?.ubicacion || 'Por confirmar'}</div>
                            </div>

                            <div class="dates-section">
                                <div class="date-block">
                                    <div class="date-label">Check-in</div>
                                    <div class="date-value">${checkin.getDate()} ${checkin.toLocaleDateString('es-ES', { month: 'short' })}</div>
                                    <div class="date-day">${checkin.toLocaleDateString('es-ES', { weekday: 'long' })}</div>
                                </div>
                                <div class="date-block">
                                    <div class="date-label">Check-out</div>
                                    <div class="date-value">${checkout.getDate()} ${checkout.toLocaleDateString('es-ES', { month: 'short' })}</div>
                                    <div class="date-day">${checkout.toLocaleDateString('es-ES', { weekday: 'long' })}</div>
                                </div>
                            </div>

                            <div style="text-align: center;">
                                <span class="nights-badge">${noches} noche${noches > 1 ? 's' : ''}</span>
                            </div>

                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-label">Huéspedes</div>
                                    <div class="info-value">${personas || 'N/A'} persona${personas > 1 ? 's' : ''}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">ID Reserva</div>
                                    <div class="info-value">#${id_reserva}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">ID Transacción</div>
                                    <div class="info-value">#${id_pago}</div>
                                </div>
                            </div>
                        </div>

                        <div class="total-section">
                            <div class="total-label">Total Pagado</div>
                            <div class="total-amount">$${total.toFixed(2)}</div>
                            <div style="font-size: 13px; opacity: 0.9; margin-top: 5px;">MXN</div>
                        </div>

                        <div class="qr-section">
                            <p><strong>Código QR de tu reserva</strong></p>
                            <p style="font-size: 13px;">Presenta este código al hacer check-in</p>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${reservationId}" alt="QR Code" />
                        </div>

                        <div class="info-box">
                            <div class="info-box-title">📋 Información Importante</div>
                            <ul>
                                <li><strong>Check-in:</strong> A partir de las 15:00 hrs</li>
                                <li><strong>Check-out:</strong> Antes de las 12:00 hrs</li>
                                <li><strong>Identificación:</strong> Requerida al momento del check-in</li>
                                <li><strong>Confirmación:</strong> Guarda este correo para tu registro</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p style="font-weight: 600; color: #2C3E50; margin-bottom: 10px;">¿Necesitas ayuda?</p>
                        <div class="contact-info">
                            <span class="contact-item">📞 +52 55 1234 5678</span>
                            <span class="contact-item">📧 soporte@reservas.com</span>
                        </div>
                        <div class="copyright">
                            © 2025 Tu Plataforma de Reservas. Todos los derechos reservados.
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    const mailOptions = {
        from: `"Sistema de Reservas" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `✅ Confirmación de Reserva ${reservationId}`,
        html: htmlEmail
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email enviado:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('  Error enviando email:', error);
        throw error;
    }
};