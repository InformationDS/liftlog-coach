import { useEffect, useState } from 'react';
export function useToast() {
  const [toast, setToast] = useState('');
  useEffect(() => {if (toast) {const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer);}}, [toast]);
  return {toast, setToast};
}

