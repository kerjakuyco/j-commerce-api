declare module 'midtrans-client' {
  export interface SnapOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  export interface SnapTransactionResponse {
    token: string;
    redirect_url: string;
  }

  export class Snap {
    constructor(options: SnapOptions);
    createTransaction(parameter: Record<string, unknown>): Promise<SnapTransactionResponse>;
  }

  const midtransClient: { Snap: typeof Snap };
  export default midtransClient;
}
