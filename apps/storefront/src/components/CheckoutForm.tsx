'use client';

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

interface CheckoutFormProps {
  onSuccess: (orderId: string) => void;
  onError: (message: string) => void;
  amount: number;
}

export default function CheckoutForm({ onSuccess, onError, amount }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message || 'Payment failed');
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      const orderId = (paymentIntent as any).metadata?.orderId;
      onSuccess(orderId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button 
        disabled={loading || !stripe}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50"
        style={{ backgroundImage: 'linear-gradient(to right, #2563eb, #7c3aed)' }}
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Processing...
          </>
        ) : (
          `Pay $${amount.toFixed(2)}`
        )}
      </button>
    </form>
  );
}
