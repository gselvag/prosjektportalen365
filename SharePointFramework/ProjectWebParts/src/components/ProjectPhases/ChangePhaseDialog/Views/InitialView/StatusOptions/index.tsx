import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import * as React from 'react';
import { IStatusOptionsProps } from './IStatusOptionsProps';

/**
 * @component StatusOptions
 */
// tslint:disable-next-line: naming-convention
export const StatusOptions = ({ actions }: IStatusOptionsProps) => {
    return (
        <div style={{ marginTop: 20, marginBottom: 25 }}>
            {actions.map((statusOpt, key) => (
                <span key={key} >
                    <PrimaryButton style={{ marginRight: 5 }} {...statusOpt} />
                </span>
            ))}
        </div>
    );
};