// AUTO-GENERATED from PR #32 HTML templates + operator expiry template.
// Do not hand-edit; regenerate from the source HTML files if copy changes.

export const templates = {
  paymentApproved: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Approved — complete payment | Drive Exotiq</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&display=swap');
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    a { color: #C8A664; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .h1 { font-size: 26px !important; line-height: 32px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#06070a;" bgcolor="#06070a">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">{{OPERATOR_NAME}} approved your {{VEHICLE_NAME}}. Complete payment by {{PAYMENT_DEADLINE}}.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#06070a" style="background-color:#06070a;">
    <tr>
      <td align="center" style="padding: 28px 12px 40px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0D0F14" style="width:600px; max-width:600px; background-color:#0D0F14; border-radius:16px; overflow:hidden; border:1px solid #2A2E3A;">

          <!-- Wordmark -->
          <tr>
            <td align="center" class="px" style="padding: 30px 40px 6px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; letter-spacing:6px; color:#C8A664; text-transform:uppercase;">Drive&nbsp;Exotiq</div>
            </td>
          </tr>

          <tr>
            <td align="center" class="px" style="padding: 22px 40px 0;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:10px; letter-spacing:4px; color:#5C6272; text-transform:uppercase;">You're approved</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 10px 40px 0;">
              <div class="h1" style="font-family:'Newsreader', Georgia, 'Times New Roman', serif; font-size:32px; line-height:38px; font-weight:500; letter-spacing:-0.4px; color:#F0F2F5;">The {{VEHICLE_SHORT}} is yours to lock in.</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 8px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#9BA1B0;">{{OPERATOR_NAME}} approved booking {{BOOKING_REF}}. Complete payment and it's confirmed.</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 18px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#14130F" style="background-color:#14130F; border:1px solid #C8A664; border-radius:12px;">
                <tr><td style="padding: 18px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style=" padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#9BA1B0; font-weight:400;">{{OPERATOR_NAME}} rental<br><span style="font-size:11px; color:#5C6272;">Appears as your operator on your statement</span></td>
                      <td align="right" style=" padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:400; white-space:nowrap;">{{RENTAL_AMOUNT}}</td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#9BA1B0; font-weight:400;">Booking fee + protection<br><span style="font-size:11px; color:#5C6272;">Appears as EXOTIQ RENT</span></td>
                      <td align="right" style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:400; white-space:nowrap;">{{EXOTIQ_AMOUNT}}</td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#F0F2F5; font-weight:700;">Total due</td>
                      <td align="right" style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:700; white-space:nowrap;">{{TOTAL_DUE}}</td>
                    </tr>

                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 14px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#161922" style="background-color:#161922; border:1px solid #2A2E3A; border-radius:12px;">
                <tr><td style="padding: 16px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Vehicle</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{VEHICLE_NAME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Dates</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{DATE_RANGE}}</div></td>
                    </tr>
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Pickup</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{PICKUP_TIME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Location</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{LOCATION}}</div></td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 24px 40px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" bgcolor="#C8A664" style="background-color:#C8A664; border-radius:12px;">
                    <a href="{{PAY_URL}}" target="_blank" style="display:block; padding:16px 24px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:700; color:#1A1308; text-decoration:none;">Complete payment</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 14px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">Your payment window closes <span style="color:#9BA1B0;">{{PAYMENT_DEADLINE}}</span> — after that the dates release back to the calendar.</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 14px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">Two charges on your statement: your operator's rental, and an <span style="color:#9BA1B0;">EXOTIQ&nbsp;RENT</span> charge for booking fee + protection. One card entry.</div>
            </td>
          </tr>


          <!-- Footer -->
          <tr>
            <td class="px" style="padding: 8px 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #2A2E3A; padding-top:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">
                  Booking {{BOOKING_REF}} &middot; {{OPERATOR_NAME}}<br>
                  Questions? Reply to this email or call your operator.<br><br>
                  <span style="letter-spacing:3px; text-transform:uppercase; font-size:10px;">Curated exotic &amp; luxury rentals</span>
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  paymentReminder: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>24 hours left to complete payment | Drive Exotiq</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&display=swap');
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    a { color: #C8A664; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .h1 { font-size: 26px !important; line-height: 32px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#06070a;" bgcolor="#06070a">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Your {{VEHICLE_NAME}} is still held — payment window closes {{PAYMENT_DEADLINE}}.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#06070a" style="background-color:#06070a;">
    <tr>
      <td align="center" style="padding: 28px 12px 40px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0D0F14" style="width:600px; max-width:600px; background-color:#0D0F14; border-radius:16px; overflow:hidden; border:1px solid #2A2E3A;">

          <!-- Wordmark -->
          <tr>
            <td align="center" class="px" style="padding: 30px 40px 6px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; letter-spacing:6px; color:#C8A664; text-transform:uppercase;">Drive&nbsp;Exotiq</div>
            </td>
          </tr>

          <tr>
            <td align="center" class="px" style="padding: 22px 40px 0;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:10px; letter-spacing:4px; color:#5C6272; text-transform:uppercase;">Payment reminder</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 10px 40px 0;">
              <div class="h1" style="font-family:'Newsreader', Georgia, 'Times New Roman', serif; font-size:32px; line-height:38px; font-weight:500; letter-spacing:-0.4px; color:#F0F2F5;">Still holding your {{VEHICLE_SHORT}}.</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 8px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#9BA1B0;">Booking {{BOOKING_REF}} is approved and waiting — the payment window closes {{PAYMENT_DEADLINE}}.</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 18px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#14130F" style="background-color:#14130F; border:1px solid #C8A664; border-radius:12px;">
                <tr><td style="padding: 18px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style=" padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#F0F2F5; font-weight:700;">Total due<br><span style="font-size:11px; color:#5C6272;">Rental + booking fee + protection</span></td>
                      <td align="right" style=" padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:700; white-space:nowrap;">{{TOTAL_DUE}}</td>
                    </tr>

                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 14px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#161922" style="background-color:#161922; border:1px solid #2A2E3A; border-radius:12px;">
                <tr><td style="padding: 16px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Vehicle</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{VEHICLE_NAME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Dates</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{DATE_RANGE}}</div></td>
                    </tr>
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Pickup</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{PICKUP_TIME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Location</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{LOCATION}}</div></td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 24px 40px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" bgcolor="#C8A664" style="background-color:#C8A664; border-radius:12px;">
                    <a href="{{PAY_URL}}" target="_blank" style="display:block; padding:16px 24px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:700; color:#1A1308; text-decoration:none;">Complete payment</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 14px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">If the window closes, the dates release automatically and the reservation ends. No charges have been made yet.</div>
            </td>
          </tr>


          <!-- Footer -->
          <tr>
            <td class="px" style="padding: 8px 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #2A2E3A; padding-top:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">
                  Booking {{BOOKING_REF}} &middot; {{OPERATOR_NAME}}<br>
                  Questions? Reply to this email or call your operator.<br><br>
                  <span style="letter-spacing:3px; text-transform:uppercase; font-size:10px;">Curated exotic &amp; luxury rentals</span>
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  receiptConfirmed: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Confirmed — your receipt | Drive Exotiq</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&display=swap');
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    a { color: #C8A664; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .h1 { font-size: 26px !important; line-height: 32px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#06070a;" bgcolor="#06070a">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Paid and confirmed. {{VEHICLE_NAME}}, {{DATE_RANGE}} — your operator will reach out before pickup.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#06070a" style="background-color:#06070a;">
    <tr>
      <td align="center" style="padding: 28px 12px 40px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0D0F14" style="width:600px; max-width:600px; background-color:#0D0F14; border-radius:16px; overflow:hidden; border:1px solid #2A2E3A;">

          <!-- Wordmark -->
          <tr>
            <td align="center" class="px" style="padding: 30px 40px 6px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; letter-spacing:6px; color:#C8A664; text-transform:uppercase;">Drive&nbsp;Exotiq</div>
            </td>
          </tr>

          <tr>
            <td align="center" class="px" style="padding: 22px 40px 0;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:10px; letter-spacing:4px; color:#5C6272; text-transform:uppercase;">Booking confirmed</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 10px 40px 0;">
              <div class="h1" style="font-family:'Newsreader', Georgia, 'Times New Roman', serif; font-size:32px; line-height:38px; font-weight:500; letter-spacing:-0.4px; color:#F0F2F5;">Confirmed. The keys are next.</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 8px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#9BA1B0;">Payment received for booking {{BOOKING_REF}}. {{OPERATOR_NAME}} will reach out before pickup.</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 18px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#14130F" style="background-color:#14130F; border:1px solid #C8A664; border-radius:12px;">
                <tr><td style="padding: 18px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style=" padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#9BA1B0; font-weight:400;">{{OPERATOR_NAME}} rental<br><span style="font-size:11px; color:#5C6272;">Appears as your operator on your statement</span></td>
                      <td align="right" style=" padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:400; white-space:nowrap;">{{RENTAL_AMOUNT}}</td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#9BA1B0; font-weight:400;">Booking fee + protection<br><span style="font-size:11px; color:#5C6272;">Appears as EXOTIQ RENT</span></td>
                      <td align="right" style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:400; white-space:nowrap;">{{EXOTIQ_AMOUNT}}</td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#F0F2F5; font-weight:700;">Total paid</td>
                      <td align="right" style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:700; white-space:nowrap;">{{TOTAL_PAID}}</td>
                    </tr>

                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 14px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#161922" style="background-color:#161922; border:1px solid #2A2E3A; border-radius:12px;">
                <tr><td style="padding: 16px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Vehicle</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{VEHICLE_NAME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Dates</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{DATE_RANGE}}</div></td>
                    </tr>
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Pickup</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{PICKUP_TIME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Location</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{LOCATION}}</div></td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 24px 40px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" bgcolor="#C8A664" style="background-color:#C8A664; border-radius:12px;">
                    <a href="{{CONFIRMATION_URL}}" target="_blank" style="display:block; padding:16px 24px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:700; color:#1A1308; text-decoration:none;">View your booking</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 14px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">Free cancellation with a full refund until 72 hours before pickup.</div>
            </td>
          </tr>


          <!-- Footer -->
          <tr>
            <td class="px" style="padding: 8px 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #2A2E3A; padding-top:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">
                  Booking {{BOOKING_REF}} &middot; {{OPERATOR_NAME}}<br>
                  Questions? Reply to this email or call your operator.<br><br>
                  <span style="letter-spacing:3px; text-transform:uppercase; font-size:10px;">Curated exotic &amp; luxury rentals</span>
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  refundConfirmation: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Refunded in full | Drive Exotiq</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&display=swap');
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    a { color: #C8A664; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .h1 { font-size: 26px !important; line-height: 32px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#06070a;" bgcolor="#06070a">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Both charges for booking {{BOOKING_REF}} have been refunded.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#06070a" style="background-color:#06070a;">
    <tr>
      <td align="center" style="padding: 28px 12px 40px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0D0F14" style="width:600px; max-width:600px; background-color:#0D0F14; border-radius:16px; overflow:hidden; border:1px solid #2A2E3A;">

          <!-- Wordmark -->
          <tr>
            <td align="center" class="px" style="padding: 30px 40px 6px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; letter-spacing:6px; color:#C8A664; text-transform:uppercase;">Drive&nbsp;Exotiq</div>
            </td>
          </tr>

          <tr>
            <td align="center" class="px" style="padding: 22px 40px 0;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:10px; letter-spacing:4px; color:#5C6272; text-transform:uppercase;">Refund confirmed</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 10px 40px 0;">
              <div class="h1" style="font-family:'Newsreader', Georgia, 'Times New Roman', serif; font-size:32px; line-height:38px; font-weight:500; letter-spacing:-0.4px; color:#F0F2F5;">Refunded in full.</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 8px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#9BA1B0;">Booking {{BOOKING_REF}} was cancelled inside the free window — both charges are on their way back.</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 18px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#14130F" style="background-color:#14130F; border:1px solid #C8A664; border-radius:12px;">
                <tr><td style="padding: 18px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style=" padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#9BA1B0; font-weight:400;">{{OPERATOR_NAME}} rental<br><span style="font-size:11px; color:#5C6272;">Refunded to your card</span></td>
                      <td align="right" style=" padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:400; white-space:nowrap;">{{RENTAL_AMOUNT}}</td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#9BA1B0; font-weight:400;">Booking fee + protection<br><span style="font-size:11px; color:#5C6272;">Refunded to your card</span></td>
                      <td align="right" style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:400; white-space:nowrap;">{{EXOTIQ_AMOUNT}}</td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; color:#F0F2F5; font-weight:700;">Total refunded</td>
                      <td align="right" style="border-top:1px solid #2A2E3A; padding:10px 0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; color:#F0F2F5; font-weight:700; white-space:nowrap;">{{TOTAL_REFUNDED}}</td>
                    </tr>

                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 14px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">Refunds typically appear on your statement within 5–10 business days, depending on your bank.</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 24px 40px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" bgcolor="#C8A664" style="background-color:#C8A664; border-radius:12px;">
                    <a href="{{STOREFRONT_URL}}" target="_blank" style="display:block; padding:16px 24px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:700; color:#1A1308; text-decoration:none;">Browse the fleet</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 14px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">The road's still there whenever you're ready.</div>
            </td>
          </tr>


          <!-- Footer -->
          <tr>
            <td class="px" style="padding: 8px 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #2A2E3A; padding-top:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">
                  Booking {{BOOKING_REF}} &middot; {{OPERATOR_NAME}}<br>
                  Questions? Reply to this email or call your operator.<br><br>
                  <span style="letter-spacing:3px; text-transform:uppercase; font-size:10px;">Curated exotic &amp; luxury rentals</span>
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  paymentExpired: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Payment window closed | Drive Exotiq</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&display=swap');
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    a { color: #C8A664; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .h1 { font-size: 26px !important; line-height: 32px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#06070a;" bgcolor="#06070a">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">The payment window for booking {{BOOKING_REF}} has closed and the dates were released.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#06070a" style="background-color:#06070a;">
    <tr>
      <td align="center" style="padding: 28px 12px 40px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0D0F14" style="width:600px; max-width:600px; background-color:#0D0F14; border-radius:16px; overflow:hidden; border:1px solid #2A2E3A;">

          <!-- Wordmark -->
          <tr>
            <td align="center" class="px" style="padding: 30px 40px 6px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; letter-spacing:6px; color:#C8A664; text-transform:uppercase;">Drive&nbsp;Exotiq</div>
            </td>
          </tr>

          <tr>
            <td align="center" class="px" style="padding: 22px 40px 0;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:10px; letter-spacing:4px; color:#5C6272; text-transform:uppercase;">Window closed</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 10px 40px 0;">
              <div class="h1" style="font-family:'Newsreader', Georgia, 'Times New Roman', serif; font-size:32px; line-height:38px; font-weight:500; letter-spacing:-0.4px; color:#F0F2F5;">The window closed on this one.</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 8px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#9BA1B0;">The 48-hour payment window for booking {{BOOKING_REF}} passed, so the dates released back to the calendar. Nothing was charged.</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 14px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#161922" style="background-color:#161922; border:1px solid #2A2E3A; border-radius:12px;">
                <tr><td style="padding: 16px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Vehicle</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{VEHICLE_NAME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Dates</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{DATE_RANGE}}</div></td>
                    </tr>
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Pickup</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{PICKUP_TIME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Location</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{LOCATION}}</div></td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 24px 40px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" bgcolor="#C8A664" style="background-color:#C8A664; border-radius:12px;">
                    <a href="{{VEHICLE_URL}}" target="_blank" style="display:block; padding:16px 24px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:700; color:#1A1308; text-decoration:none;">Book it again</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 14px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">Same car, new dates — approval is usually faster the second time.</div>
            </td>
          </tr>


          <!-- Footer -->
          <tr>
            <td class="px" style="padding: 8px 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #2A2E3A; padding-top:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">
                  Booking {{BOOKING_REF}} &middot; {{OPERATOR_NAME}}<br>
                  Questions? Reply to this email or call your operator.<br><br>
                  <span style="letter-spacing:3px; text-transform:uppercase; font-size:10px;">Curated exotic &amp; luxury rentals</span>
                </td></tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  operatorExpired: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Payment window expired | Drive Exotiq</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&display=swap');
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    a { color: #C8A664; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .h1 { font-size: 26px !important; line-height: 32px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#06070a;" bgcolor="#06070a">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Booking {{BOOKING_REF}} payment window expired and the dates were released.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#06070a" style="background-color:#06070a;">
    <tr>
      <td align="center" style="padding: 28px 12px 40px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0D0F14" style="width:600px; max-width:600px; background-color:#0D0F14; border-radius:16px; overflow:hidden; border:1px solid #2A2E3A;">
          <tr>
            <td align="center" class="px" style="padding: 30px 40px 6px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; letter-spacing:6px; color:#C8A664; text-transform:uppercase;">Drive&nbsp;Exotiq</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 22px 40px 0;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:10px; letter-spacing:4px; color:#5C6272; text-transform:uppercase;">Booking expired</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 10px 40px 0;">
              <div class="h1" style="font-family:'Newsreader', Georgia, 'Times New Roman', serif; font-size:32px; line-height:38px; font-weight:500; letter-spacing:-0.4px; color:#F0F2F5;">Payment window expired.</div>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 12px 48px 8px;">
              <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#9BA1B0;">The 48-hour payment window for booking {{BOOKING_REF}} passed. The dates have been released back to your calendar and the renter was notified.</div>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 14px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#161922" style="background-color:#161922; border:1px solid #2A2E3A; border-radius:12px;">
                <tr><td style="padding: 16px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Vehicle</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{VEHICLE_NAME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Dates</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{DATE_RANGE}}</div></td>
                    </tr>
                    <tr>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Pickup</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{PICKUP_TIME}}</div></td>
                      <td width="50%" style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding:6px 0;"><div style="font-size:10px; letter-spacing:2.5px; color:#5C6272; text-transform:uppercase;">Location</div><div style="font-size:14px; color:#F0F2F5; padding-top:2px;">{{LOCATION}}</div></td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="px" style="padding: 24px 40px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" bgcolor="#C8A664" style="background-color:#C8A664; border-radius:12px;">
                    <a href="{{CONFIRMATION_URL}}" target="_blank" style="display:block; padding:16px 24px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:700; color:#1A1308; text-decoration:none;">View booking</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="px" style="padding: 8px 40px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #2A2E3A; padding-top:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#5C6272;">
                  Booking {{BOOKING_REF}} &middot; {{OPERATOR_NAME}}<br>
                  Operator notification from Drive Exotiq.<br><br>
                  <span style="letter-spacing:3px; text-transform:uppercase; font-size:10px;">Curated exotic &amp; luxury rentals</span>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,

  // Stub for the post-payment ID-verify drip. Insurance-upload flow ships
  // separately; this template mentions it as "coming next" so we don't
  // block launch on the insurance surface. Refresh copy once insurance is
  // wired.
  verifyIdRequested: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment received — verify your ID next | Drive Exotiq</title>
</head>
<body style="margin:0; padding:0; background:#0E1013; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#F0F2F5;">
  <div style="display:none; max-height:0; overflow:hidden;">Payment received for booking {{BOOKING_REF}} — verify your ID to lock in {{VEHICLE_SHORT}} for {{DATE_RANGE}}.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0E1013;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#151821; border-radius:12px; padding:32px;">
        <tr><td>
          <div style="font-size:12px; letter-spacing:2px; color:#8E95A3; text-transform:uppercase; margin-bottom:8px;">Payment received</div>
          <h1 style="font-size:24px; line-height:32px; margin:0 0 16px; color:#F0F2F5; font-weight:700;">Now let's verify your ID</h1>
          <p style="font-size:14px; line-height:22px; color:#C4C9D3; margin:0 0 20px;">
            Thanks — your payment for <strong>{{VEHICLE_SHORT}}</strong> on {{DATE_RANGE}} has cleared
            (booking {{BOOKING_REF}}). To finalize your reservation, please verify your ID with our
            secure partner. It takes about two minutes.
          </p>
          <div style="margin:24px 0;">
            <a href="{{VERIFY_URL}}" style="display:inline-block; background:#F0F2F5; color:#0E1013; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:14px;">Verify my ID</a>
          </div>
          <p style="font-size:13px; line-height:20px; color:#8E95A3; margin:0 0 16px;">
            Insurance upload is coming next — we'll send a separate link once you've cleared ID verification.
          </p>
          <p style="font-size:12px; line-height:18px; color:#5C6272; margin:24px 0 0; padding-top:16px; border-top:1px solid #2A2E3A;">
            Booking {{BOOKING_REF}} · Operator: {{OPERATOR_NAME}} · Questions? Just reply to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  // depositCardRequested template removed 2026-07-28. Exotiq exited the
  // security-deposit flow entirely — renters settle the deposit with the
  // operator at pickup by whatever method the operator accepts.
} as const;


export type TemplateName = keyof typeof templates;
