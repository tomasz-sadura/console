/* eslint-disable no-useless-escape */
import { CheckCircleTwoTone, ExclamationCircleTwoTone, EyeInvisibleOutlined, EyeTwoTone, WarningTwoTone } from '@ant-design/icons';
import { Button, Collapse, Input, InputNumber, message, notification, Popover, Statistic, Switch, Select } from 'antd';
import { motion } from 'framer-motion';
import { autorun, IReactionDisposer, makeObservable, observable, untracked } from 'mobx';
import { observer } from 'mobx-react';
import { Component } from 'react';
import { InfoText } from '../../../../utils/tsxUtils';


import postgresProps from '../../../../assets/postgres.json';


// React Editor
import KowlEditor from '../../../misc/KowlEditor';

// Monaco Type
import * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
export type Monaco = typeof monacoType;


type ArrayElement<ArrayType extends readonly unknown[]> =
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

type PropertyEntry = ArrayElement<typeof postgresProps.configs>;

interface PropertyGroup {
    groupName: string;
    properties: Property[];
}

interface Property {
    name: string;
    entry: PropertyEntry;
    value: string | number | boolean | string[];

    isHidden: boolean; // currently only used for "connector.class"
}

interface DemoPageProps {
    onChange: (jsonText: string) => void
}

@observer
export class DemoPage extends Component<DemoPageProps> {

    @observable allGroups: PropertyGroup[] = [];
    // @observable propertiesMap = new Map<string, Property>();
    @observable jsonText = "";

    constructor(p: any) {
        super(p);
        makeObservable(this);

        const allProps = postgresProps.configs
            .map(p => ({
                name: p.definition.name,
                entry: p,
                value: p.value.value ?? p.definition.default_value,
                isHidden: ["connector.class"].includes(p.definition.name),
            } as Property))
            .sort((a, b) => a.entry.definition.order - b.entry.definition.order);

        this.allGroups = allProps
            .groupInto(p => p.entry.definition.group)
            .map(g => ({ groupName: g.key, properties: g.items } as PropertyGroup));

        // Create json for use in editor
        autorun(() => {
            const jsonObj = {} as any;
            for (const g of this.allGroups)
                for (const p of g.properties)
                    jsonObj[p.name] = p.value;
            this.jsonText = JSON.stringify(jsonObj, undefined, 4);
        });

        autorun(() => {
            this.props.onChange(this.jsonText)
        })

    }

    render() {
        if (this.allGroups.length == 0)
            return <div>no groups</div>

        // const defaultExpanded = this.allGroups.map(x => x.groupName);
        const defaultExpanded = this.allGroups[0].groupName;

        // render components dynamically
        return <>
            <Collapse defaultActiveKey={defaultExpanded} ghost bordered={false}>
                {this.allGroups.map(g =>
                    <Collapse.Panel
                        key={g.groupName}
                        header={<div style={{ fontSize: 'larger', fontWeight: 600, fontFamily: 'Open Sans' }}>{g.groupName}</div>}
                    >
                        <PropertyGroupComponent group={g} />
                    </Collapse.Panel>
                )}
            </Collapse>

            <DebugEditor observable={this} />
        </>;
    }
}

const PropertyGroupComponent = (props: { group: PropertyGroup }) => {
    const g = props.group;

    return <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5em' }}>
        {g.properties.map(p => <PropertyComponent key={p.name} property={p} />)}
    </div>
}

const requiredStar = <span style={{ lineHeight: '0px', color: 'red', fontSize: '1.5em', marginRight: '3px', marginTop: '5px', maxHeight: '0px' }}>*</span>;

const PropertyComponent = observer((props: { property: Property }) => {
    const p = props.property;
    const def = p.entry.definition;
    if (p.isHidden) return null;

    let comp = <div key={p.name}>
        <div>"{p.name}" (unknown type "{def.type}")</div>
        <div style={{ fontSize: 'smaller' }} className='codeBox'>{JSON.stringify(p.entry, undefined, 4)}</div>
    </div>;

    switch (def.type) {
        case "STRING":
        case "CLASS":
            let v = p.value;
            if (typeof p.value != 'string')
                if (typeof p.value == 'number' || typeof p.value == 'boolean')
                    v = String(v);
                else
                    v = "";

            const recValues = p.entry.value.recommended_values;
            if (recValues && recValues.length) {
                const options = recValues.map((x: string) => ({ label: x, value: x }));
                // Enum
                comp = <Select style={{ width: 200 }} showSearch
                    options={options}
                />
            }
            else {
                // Text or Password
                comp = <Input value={String(v)} onChange={e => p.value = e.target.value} defaultValue={def.default_value ?? undefined} />
            }

            break;

        case "PASSWORD":
            comp = <Input.Password value={String(p.value ?? '')} onChange={e => p.value = e.target.value} iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} />
            break;

        case "INT":
        case "LONG":
            comp = <InputNumber style={{ display: 'block' }} value={Number(p.value)} onChange={e => p.value = e} />
            break;

        case "BOOLEAN":
            comp = <Switch checked={Boolean(p.value)} onChange={e => p.value = e} />
            break;

    }



    // Attach tooltip
    let name = <span style={{ fontWeight: 600 }}>{def.display_name}</span>;
    if (def.documentation)
        name = <InfoText tooltip={def.documentation} iconSize='12px' transform='translateY(1px)' gap='6px' placement='right' maxWidth='450px' align='left' >{name}</InfoText>

    // Wrap name and input element
    return <div>
        <div style={{ display: 'flex', width: 'fit-content', alignItems: 'center', marginBottom: '4px' }}>
            {def.required && requiredStar}
            {name}
        </div>

        {/* Control */}
        {comp}
    </div>
});




const DebugEditor = observer((p: { observable: { jsonText: string } }) => {
    const obs = p.observable;

    return <div style={{ marginTop: '1.5em' }}>
        <h4>Debug Editor</h4>
        <KowlEditor
            language='json'

            value={obs.jsonText}
            onChange={(v, e) => {
                if (v) {
                    if (!obs.jsonText && !v)
                        return; // dont replace undefiend with empty (which would trigger our 'autorun')
                    obs.jsonText = v;
                }
            }}
            height="300px"
        />
        </div>

});