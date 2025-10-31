import React from 'react';
import { WandIcon } from './Icons';
import { Toggle, ToggleProps } from './Toggle';

type RefinementToggleProps = Omit<ToggleProps, 'label' | 'icon' | 'id'>;

export const RefinementToggle: React.FC<RefinementToggleProps> = (props) => {
  return (
    <Toggle
      id="refinement-toggle"
      label="Iterative Refinement"
      icon={<WandIcon className="w-5 h-5" />}
      {...props}
    />
  );
};
