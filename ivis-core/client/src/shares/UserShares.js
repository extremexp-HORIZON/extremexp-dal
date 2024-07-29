'use strict';

import React, {Component} from 'react';
import PropTypes
    from 'prop-types';
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from '../lib/page';
import {
    withAsyncErrorHandler,
    withErrorHandling
} from '../lib/error-handling';
import {Table} from '../lib/table';
import axios
    from '../lib/axios';
import {Icon} from "../lib/bootstrap-components";
import {Panel} from "../lib/panel";
import {getUrl} from "../lib/urls";
import em
    from '../lib/extension-manager';
import {withComponentMixins} from "../lib/decorator-helpers";

import {withTranslation} from "../lib/i18n";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class UserShares extends Component {
    constructor(props) {
        super(props);

        this.sharesTables = {};
    }

    static propTypes = {
        user: PropTypes.object
    }

    @withAsyncErrorHandler
    async deleteShare(entityTypeId, entityId) {
        const data = {
            entityTypeId,
            entityId,
            userId: this.props.user.id
        };

        await axios.put(getUrl('rest/shares'), data);
        for (const key in this.sharesTables) {
            this.sharesTables[key].refresh();
        }
    }

    componentDidMount() {
    }

    render() {
        const t = this.props.t;

        const renderSharesTable = (entityTypeId, title) => {
            const columns = [
                { data: 0, title: t('Name') },
                { data: 1, title: t('Role') },
                {
                    title: t('Action'),
                    actions: data => {
                        const actions = [];
                        const autoGenerated = data[3];
                        const perms = data[4];

                        if (!autoGenerated && perms.includes('share')) {
                            actions.push({
                                label: <Icon icon="remove" title={t('Remove')} />,
                                action: () => this.deleteShare(entityTypeId, data[2])
                            });
                        }

                        return actions;
                    }
                }
            ];

            return (
                <div key={entityTypeId}>
                    <h3>{title}</h3>
                    <Table ref={node => this.sharesTables[entityTypeId] = node} withHeader dataUrl={`rest/shares-table-by-user/${entityTypeId}/${this.props.user.id}`} columns={columns} />
                </div>
            );
        };

        const shareElements = [
            {entityTypeId: 'namespace', label: t('Namespaces')},
            {entityTypeId: 'workspace', label: t('Workspaces')},
            {entityTypeId: 'panel', label: t('Panels')},
            {entityTypeId: 'template', label: t('Templates')},
            {entityTypeId: 'signalSet', label: !em.get('settings.signalSetsAsSensors', false) ? t('Signal Sets') : t('Sensors')},
            {entityTypeId: 'signal', label: t('Signals')},
        ];

        em.invoke('app.share.table.updateEntities', shareElements);

        const sharesTableElement = shareElements.map(entry => renderSharesTable(entry.entityTypeId, entry.label));

        return (
            <Panel title={t('Shares for user "{{username}}"', { username: this.props.user.username })}>
                {sharesTableElement}
            </Panel>
        );
    }
}