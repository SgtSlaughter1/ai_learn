<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password — AceDrill</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #F3F6F4;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1F2937;
            -webkit-font-smoothing: antialiased;
        }
        table {
            border-collapse: collapse;
        }
        .container {
            width: 100%;
            max-width: 580px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        .header {
            text-align: center;
            padding-bottom: 24px;
        }
        .brand-title {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.05em;
            color: #183B2B;
            text-decoration: none;
            display: inline-block;
        }
        .card {
            background-color: #FFFFFF;
            border-radius: 16px;
            border: 1px solid #E5E9E7;
            padding: 40px 36px;
            box-shadow: 0 4px 16px rgba(24, 59, 43, 0.04);
        }
        .greeting {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 16px 0;
        }
        .paragraph {
            font-size: 15px;
            line-height: 1.65;
            color: #4B5563;
            margin: 0 0 24px 0;
        }
        .button-wrapper {
            text-align: center;
            margin: 32px 0;
        }
        .btn-primary {
            display: inline-block;
            background-color: #183B2B;
            color: #FFFFFF !important;
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
            padding: 14px 34px;
            border-radius: 10px;
            letter-spacing: 0.01em;
            box-shadow: 0 2px 8px rgba(24, 59, 43, 0.25);
        }
        .info-box {
            background-color: #F0FDF4;
            border: 1px solid #BBF7D0;
            border-radius: 10px;
            padding: 14px 16px;
            margin: 24px 0;
            font-size: 13.5px;
            color: #166534;
            line-height: 1.5;
        }
        .divider {
            border-top: 1px solid #E5E7EB;
            margin: 28px 0 20px 0;
        }
        .fallback-section {
            font-size: 12.5px;
            line-height: 1.6;
            color: #6B7280;
        }
        .fallback-link {
            color: #183B2B;
            word-break: break-all;
            text-decoration: underline;
        }
        .footer {
            text-align: center;
            padding-top: 24px;
            font-size: 12px;
            color: #9CA3AF;
        }
    </style>
</head>
<body>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F6F4; min-height: 100vh;">
        <tr>
            <td align="center">
                <div class="container">
                    <div class="header">
                        <span class="brand-title">AceDrill</span>
                    </div>
                    
                    <div class="card">
                        <h1 class="greeting">Hello, {{ $name }}!</h1>
                        
                        <p class="paragraph">
                            We received a request to reset the password for your AceDrill account. You can securely set a new password by clicking the button below:
                        </p>
                        
                        <div class="button-wrapper">
                            <a href="{{ $resetUrl }}" target="_blank" class="btn-primary">
                                Reset Password
                            </a>
                        </div>
                        
                        <div class="info-box">
                            <strong>Notice:</strong> This password reset link will expire in {{ $expireMinutes }} minutes. If you did not make this request, you can safely ignore this email.
                        </div>
                        
                        <p class="paragraph" style="margin-bottom: 0;">
                            Best regards,<br>
                            <strong style="color: #183B2B;">AceDrill Team</strong>
                        </p>
                        
                        <div class="divider"></div>
                        
                        <div class="fallback-section">
                            If you're having trouble clicking the "Reset Password" button, copy and paste the URL below into your web browser:<br>
                            <a href="{{ $resetUrl }}" class="fallback-link">{{ $resetUrl }}</a>
                        </div>
                    </div>
                    
                    <div class="footer">
                        &copy; {{ date('Y') }} AceDrill Platform. All rights reserved.
                    </div>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
