import { DisplayMode } from '@microsoft/sp-core-library';
import { WebPartTitle } from "@pnp/spfx-controls-react/lib/WebPartTitle";
import { HubConfigurationService } from 'shared/lib/services';
import { DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';
import { Spinner } from 'office-ui-fabric-react/lib/Spinner';
import * as strings from 'ProjectWebPartsStrings';
import * as React from 'react';
import SpEntityPortalService from 'sp-entityportal-service';
import * as format from 'string-format';
import { IProjectInformationData } from './IProjectInformationData';
import { IProjectInformationProps, ProjectInformationDefaultProps } from './IProjectInformationProps';
import { IProjectInformationState } from './IProjectInformationState';
import styles from './ProjectInformation.module.scss';
import { ProjectProperty, ProjectPropertyModel } from './ProjectProperty';
import { PnPClientStorage, dateAdd } from '@pnp/common';

export class ProjectInformation extends React.Component<IProjectInformationProps, IProjectInformationState> {
  public static defaultProps = ProjectInformationDefaultProps;
  private _hubConfigurationService: HubConfigurationService;
  private _spEntityPortalService: SpEntityPortalService;


  constructor(props: IProjectInformationProps) {
    super(props);
    this.state = { isLoading: true, data: {} };
  }

  public async componentDidMount() {
    try {
      const data = await this.fetchData();
      this.setState({ data, isLoading: false });
    } catch (error) {
      this.setState({ error, isLoading: false });
    }
  }

  public render(): React.ReactElement<IProjectInformationProps> {
    return (
      <div className={styles.projectInformation}>
        <div className={styles.container}>
          <WebPartTitle
            displayMode={DisplayMode.Read}
            title={this.props.title}
            updateProperty={_ => { }} />
          {this.renderInner()}
        </div>
      </div>
    );
  }

  /**
   * Render component inner
   */
  private renderInner() {
    if (this.state.isLoading) {
      return <Spinner label={format(strings.LoadingText, 'prosjektinformasjon')} />;
    }
    if (this.state.error) {
      return <MessageBar messageBarType={MessageBarType.error}>{format(strings.ErrorText, 'prosjektinformasjon')}</MessageBar>;
    }
    return (
      <div>
        {this.renderProperties()}
        <div className={styles.actions} hidden={this.props.hideActions || !this.props.isSiteAdmin}>
          <div>
            <DefaultButton
              text={strings.ViewVersionHistoryText}
              href={this.state.data.versionHistoryUrl}
              iconProps={{ iconName: 'History' }}
              style={{ width: 250 }} />
          </div>
          <div>
            <DefaultButton
              text={strings.EditPropertiesText}
              href={this.state.data.editFormUrl}
              iconProps={{ iconName: 'Edit' }}
              style={{ width: 250 }} />
          </div>
          <div>
            <DefaultButton
              text={strings.EditSiteInformationText}
              onClick={_ => window['_spLaunchSiteSettings']()}
              disabled={!window['_spLaunchSiteSettings']}
              iconProps={{ iconName: 'Info' }}
              style={{ width: 250 }} />
          </div>
        </div>
      </div >
    );
  }

  /**
   * Render properties
   */
  private renderProperties() {
    if (this.state.data.properties) {
      const propertiesToRender = this.state.data.properties.filter(p => !p.empty && p.showInDisplayForm);
      const hasMissingProps = this.state.data.properties.filter(p => p.required && p.empty).length > 0;
      if (hasMissingProps) {
        return <MessageBar messageBarType={MessageBarType.error}>{strings.MissingPropertiesMessage}</MessageBar>;
      }
      if (propertiesToRender.length === 0) {
        return <MessageBar>{strings.NoPropertiesMessage}</MessageBar>;
      }
      return (
        <div>
          {propertiesToRender.map((model, key) => {
            return <ProjectProperty key={key} model={model} />;
          })}
        </div>
      );
    } else {
      return null;
    }
  }

  /**
   * Fetch configuration
   * 
   * @param {string} key Key for cache
   * @param {Date} expire Expire for cache
   */
  private async fetchConfiguration(key: string = 'projectinformation_fetchconfiguration', expire: Date = dateAdd(new Date(), 'minute', 15)) {
    return new PnPClientStorage().session.getOrPut(key, async () => {
      const [columnConfig, fields] = await Promise.all([
        this._hubConfigurationService.getProjectColumns(),
        this._spEntityPortalService.getEntityFields(),
      ]);
      return { columnConfig, fields };
    }, expire);
  }

  private async fetchData(): Promise<IProjectInformationData> {
    this._hubConfigurationService = new HubConfigurationService(this.props.hubSiteUrl);
    this._spEntityPortalService = new SpEntityPortalService({ webUrl: this.props.hubSiteUrl, ...this.props.entity });
    try {
      const [configuration, editFormUrl, versionHistoryUrl, entityItem] = await Promise.all([
        this.fetchConfiguration(),
        this._spEntityPortalService.getEntityEditFormUrl(this.props.siteId, this.props.webUrl),
        this._spEntityPortalService.getEntityVersionHistoryUrl(this.props.siteId, this.props.webUrl),
        this._spEntityPortalService.getEntityItemFieldValues(this.props.siteId),
      ]);
      let properties = Object.keys(entityItem)
        .filter(fieldName => {
          let [field] = configuration.fields.filter(fld => fld.InternalName === fieldName);
          let [column] = configuration.columnConfig.filter(c => c.GtInternalName === fieldName);
          if (field && column) {
            return this.props.filterField ? column[this.props.filterField] : true;
          }
          return false;
        })
        .map(fieldName => new ProjectPropertyModel(configuration.fields.filter(fld => fld.InternalName === fieldName)[0], entityItem[fieldName]));
      return {
        properties,
        editFormUrl,
        versionHistoryUrl,
        itemId: entityItem.ID,
      };
    } catch (error) {
      throw error;
    }
  }
}

export { ProjectInformationModal } from '../ProjectInformationModal';
export { IProjectInformationProps, ProjectProperty };

