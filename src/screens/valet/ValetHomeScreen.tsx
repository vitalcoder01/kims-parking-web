import React, {useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {GateValetScreen} from './GateValetScreen';
import {LotValetScreen} from './LotValetScreen';

/**
 * ValetHomeScreen: Top-level Workstation Router for Valet Operations.
 *
 * Physically separates the two distinct operational stations:
 * 1. Gate Counter Workstation (Curbside turnover, key collection, visitor intake, arrivals radar)
 * 2. Parking Lot Workstation (Spatial bay allocation, retrieval urgency SLA board, runner dispatch)
 *
 * Dedicated accounts (user.valetStation === 'gate' | 'lot') are pinned directly to their station.
 * Unassigned / Supervisor accounts (user.valetStation === null) default to Gate Counter with a 1-tap
 * station toggle to switch between Gate and Lot desks on demand.
 */
export function ValetHomeScreen() {
  const {user} = useAuth();
  const myStation = user?.valetStation ?? null;
  const [supervisorStation, setSupervisorStation] = useState<'gate' | 'lot'>('gate');

  const effectiveStation = myStation ?? supervisorStation;

  if (effectiveStation === 'gate') {
    return (
      <GateValetScreen
        isSupervisor={myStation === null}
        onSwitchStation={myStation === null ? () => setSupervisorStation('lot') : undefined}
      />
    );
  }

  return (
    <LotValetScreen
      isSupervisor={myStation === null}
      onSwitchStation={myStation === null ? () => setSupervisorStation('gate') : undefined}
    />
  );
}
