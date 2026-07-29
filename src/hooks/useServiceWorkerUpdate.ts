import {useEffect, useState} from 'react';
import {onUpdateAvailable, applyServiceWorkerUpdate} from '../services/swRegistration';

export function useServiceWorkerUpdate() {
  const [available, setAvailable] = useState(false);

  useEffect(() => onUpdateAvailable(() => setAvailable(true)), []);

  const applyUpdate = () => applyServiceWorkerUpdate();

  return {available, applyUpdate};
}
