import nodemailer from "nodemailer";

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  try {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      console.error("sendEmail: missing GMAIL_USER or GMAIL_APP_PASSWORD");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Curiosity60Seconds" <${user}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  } catch (error) {
    console.error("sendEmail failed", error);
  }
}
