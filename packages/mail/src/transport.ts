import nodemailer from "nodemailer"
import { mailEnv } from "./keys"

export type SmtpTransportOptions = {
  host: string
  port: number
  username: string
  password: string
}

export const createSmtpTransporter = (options?: SmtpTransportOptions) =>
  nodemailer.createTransport(
    options
      ? {
          host: options.host,
          port: options.port,
          secure: options.port === 465,
          auth: { user: options.username, pass: options.password },
        }
      : mailEnv.SMTP_SERVER,
  )

/** Create a transporter from a nodemailer connection URL (e.g. smtp:// or smtps://). */
export const createSmtpTransporterFromUrl = (url: string) =>
  nodemailer.createTransport(url)
