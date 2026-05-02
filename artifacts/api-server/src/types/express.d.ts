declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        name: string;
        role: string;
      };
    }
  }
}

export {};
