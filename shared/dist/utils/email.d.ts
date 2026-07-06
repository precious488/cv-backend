export interface SendEmailInput {
    to: string;
    subject: string;
    text: string;
    html: string;
}
export declare function sendEmail(input: SendEmailInput): Promise<void>;
