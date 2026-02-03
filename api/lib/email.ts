// ============================================================================
// Email Notification Module
// ============================================================================
// Sends email notifications for admin actions
// Uses Resend with custom domain (turnstone.ltd)
// ============================================================================

import { Resend } from 'resend';

// Lazy initialization of Resend to ensure environment variables are loaded
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Admin email address (can be multiple admins)
const ADMIN_EMAILS = ['tom.galia@outlook.com'];

/**
 * Send email notification to admins when a new user registers
 */
export async function notifyAdminNewUser(
  userEmail: string,
  userName?: string
): Promise<void> {
  // Skip if Resend is not configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not configured - skipping email notification');
    return;
  }

  try {
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: 'Medical Code Set Builder <admin@turnstone.ltd>',
      to: ADMIN_EMAILS,
      subject: 'New User Pending Approval - MCSB',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New User Registration</h2>

          <p>A new user has registered and is awaiting approval:</p>

          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
            ${userName ? `<p style="margin: 5px 0;"><strong>Name:</strong> ${userName}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Registered:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <p>
            <a href="https://codes.turnstone.ltd/admin"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review User in Admin Panel
            </a>
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />

          <p style="color: #6b7280; font-size: 14px;">
            Medical Code Set Builder - Powered by OMOP Vocabulary Tables
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Failed to send admin notification email:', error);
      throw error;
    }

    console.log('✅ Admin notification email sent:', data?.id);
  } catch (error) {
    // Don't throw error - email failures shouldn't break user registration
    console.error('❌ Email notification error:', error);
  }
}

/**
 * Send welcome email to user after approval
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName?: string
): Promise<void> {
  // Skip if Resend is not configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not configured - skipping email notification');
    return;
  }

  try {
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: 'Medical Code Set Builder <noreply@turnstone.ltd>',
      to: [userEmail],
      subject: 'Welcome to Medical Code Set Builder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Your Account Has Been Approved!</h2>

          <p>Hello${userName ? ` ${userName}` : ''},</p>

          <p>Great news! Your account has been approved and you now have full access to the Medical Code Set Builder.</p>

          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <p style="margin: 5px 0; font-weight: bold;">You can now:</p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Search and explore OMOP vocabulary concepts</li>
              <li>Build custom code sets for your research</li>
              <li>Save and export your code sets</li>
              <li>Access lab test panel search functionality</li>
            </ul>
          </div>

          <p>
            <a href="https://codes.turnstone.ltd"
               style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Start Building Code Sets
            </a>
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />

          <p style="color: #6b7280; font-size: 14px;">
            Need help? Contact your administrator at ${ADMIN_EMAILS[0]}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Failed to send welcome email:', error);
      throw error;
    }

    console.log('✅ Welcome email sent:', data?.id);
  } catch (error) {
    // Don't throw error - email failures shouldn't break the approval process
    console.error('❌ Email notification error:', error);
  }
}
