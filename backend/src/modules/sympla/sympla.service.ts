import axios from 'axios';
import { decrypt } from '../../common/utils/encryption';

const SYMPLA_BASE_URL = process.env.SYMPLA_BASE_URL || 'https://api.sympla.com.br/public/v4';

export class SymplaService {
  private token: string;

  constructor(encryptedToken: string) {
    this.token = decrypt(encryptedToken);
  }

  private getHeaders() {
    return {
      's_token': this.token,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${SYMPLA_BASE_URL}/events`, {
        headers: this.getHeaders(),
        params: { page_size: 1 },
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getEvents(page: number = 1, pageSize: number = 100): Promise<any> {
    const response = await axios.get(`${SYMPLA_BASE_URL}/events`, {
      headers: this.getHeaders(),
      params: { page, page_size: pageSize },
    });
    return response.data;
  }

  async getEventOrders(eventId: string, page: number = 1, pageSize: number = 100): Promise<any> {
    const response = await axios.get(`${SYMPLA_BASE_URL}/events/${eventId}/orders`, {
      headers: this.getHeaders(),
      params: { page, page_size: pageSize },
    });
    return response.data;
  }

  async getOrderParticipants(eventId: string, orderId: string): Promise<any> {
    const response = await axios.get(
      `${SYMPLA_BASE_URL}/events/${eventId}/orders/${orderId}/participants`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getEventParticipants(eventId: string, page: number = 1, pageSize: number = 200): Promise<any> {
    const response = await axios.get(`${SYMPLA_BASE_URL}/events/${eventId}/participants`, {
      headers: this.getHeaders(),
      params: { page, page_size: pageSize },
    });
    return response.data;
  }
}
