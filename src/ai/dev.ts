
'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/intelligent-reorder-suggestions.ts';
import '@/ai/flows/demand-forecasting-dashboard.ts';
import '@/ai/flows/product-demand-forecast.ts';
import '@/ai/flows/dashboard-summary.ts';
import '@/ai/flows/generate-product-details.ts';
import '@/ai/flows/financial-analysis.ts';
import '@/ai/flows/inventory-chatbot.ts';
