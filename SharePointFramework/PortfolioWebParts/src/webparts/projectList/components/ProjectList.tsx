import * as React from 'react';
import styles from './ProjectList.module.scss';
import * as strings from 'ProjectListWebPartStrings';
import { IProjectListProps } from './IProjectListProps';
import { IProjectListState, IProjectListData } from './IProjectListState';
import { Spinner, SpinnerType } from 'office-ui-fabric-react/lib/Spinner';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { MessageBar } from 'office-ui-fabric-react/lib/MessageBar';
import { Modal } from 'office-ui-fabric-react/lib/Modal';
import { autobind } from 'office-ui-fabric-react/lib/Utilities';
import ProjectCard from './ProjectCard/ProjectCard';
import { sp, QueryPropertyValueType } from '@pnp/sp';
import { taxonomy } from '@pnp/sp-taxonomy';
import ProjectInformation from '../../../../../ProjectWebParts/lib/webparts/projectInformation/components/ProjectInformation';
import { ProjectListModel } from 'prosjektportalen-spfx-shared/lib/models/ProjectListModel';

export default class ProjectList extends React.Component<IProjectListProps, IProjectListState> {
  constructor(props: IProjectListProps) {
    super(props);
    this.state = { projects: [], isLoading: true };
  }

  public async componentDidMount() {
    await this.fetchData();
  }

  public render(): React.ReactElement<IProjectListProps> {
    if (this.state.isLoading) {
      return <Spinner label={strings.LoadingProjectsLabel} type={SpinnerType.large} />;
    }
    return (
      <div className={styles.projectList}>
        {this.state.selectedProject && (
          <Modal
            isOpen={true}
            containerClassName={styles.projectInfoModal}
            onDismiss={_e => this.setState({ selectedProject: null })}>
            <ProjectInformation
              title={this.state.selectedProject.Title}
              entity={{ webUrl: this.props.siteAbsoluteUrl, ...this.props.entity }}
              hubSiteUrl={this.props.siteAbsoluteUrl}
              siteId={this.state.selectedProject.Id}
              hideEditPropertiesButton={true}
              filterField='GtShowFieldPortfolio' />
          </Modal>
        )}
        <div className={styles.searchBox}>
          <SearchBox placeholder={strings.SearchBoxPlaceholderText} onChanged={this.onSearch} />
        </div>
        <div className={styles.container}>
          {this.renderCards()}
        </div>
      </div>
    );
  }

  private renderCards() {
    const { projects } = this.getFilteredData();
    if (projects.length === 0) {
      return (
        <MessageBar>{strings.NoSearchResults}</MessageBar>
      );
    }
    return projects.map(project => (
      <ProjectCard
        project={project}
        onClickHref={project.Url}
        selectedProject={this.onSelectProject} />
    ));
  }

  @autobind
  private onSelectProject(event: React.MouseEvent<any>, project: ProjectListModel) {
    event.stopPropagation();
    event.preventDefault();
    this.setState({ selectedProject: project });
  }

  private getFilteredData(): IProjectListData {
    const { data, searchTerm } = this.state;
    if (searchTerm) {
      const projects = data.projects
        .filter(project => {
          const matches = Object.keys(project).filter(key => {
            const value = project[key];
            return value && typeof value === 'string' && value.toLowerCase().indexOf(searchTerm) !== -1;
          }).length;
          return matches > 0;
        })
        .sort((a, b) => a.Title > b.Title ? 1 : -1);
      return { ...data, projects };
    } else return { ...data };
  }

  @autobind
  private onSearch(searchTerm: string) {
    this.setState({ searchTerm: searchTerm.toLowerCase() });
  }

  private async fetchData() {
    let [projectListItems, users, phaseTerms, { PrimarySearchResults: associatedSites }] = await Promise.all([
      sp.web.lists.getByTitle(this.props.entity.listName).items.usingCaching().get(),
      sp.web.siteUsers.usingCaching().get(),
      taxonomy.getDefaultSiteCollectionTermStore().getTermSetById(this.props.phaseTermSetId).terms.usingCaching().get(),
      sp.search({
        Querytext: `DepartmentId:${this.props.siteId} contentclass:STS_Site`,
        TrimDuplicates: false,
        RowLimit: 500,
        SelectProperties: ['Title', 'Path', 'DepartmentId', 'SiteId', 'SiteLogo'],
        Properties: [{
          Name: 'EnableDynamicGroups',
          Value: {
            BoolVal: true,
            QueryPropertyValueTypeIndex: QueryPropertyValueType.BooleanType
          }
        }]
      }),
    ]);
    let projects = associatedSites
      .map(site => {
        let [item] = projectListItems.filter(p => site['SiteId'] === p.GtSiteId);
        if (item) {
          let [owner] = users.filter(user => user.Id === item.GtProjectOwnerId);
          let [manager] = users.filter(user => user.Id === item.GtProjectManagerId);
          let phase = item.GtProjectPhase ? phaseTerms.filter(p => p.Id.indexOf(item.GtProjectPhase.TermGuid) !== -1)[0].Name : '';

          const project: ProjectListModel = {
            Id: site['SiteId'],
            Logo: site.SiteLogo,
            Manager: manager,
            Owner: owner,
            Phase: phase,
            Title: site.Title,
            Url: site.Path,
          };
          return project;
        }
        return null;
      })
      .filter(p => p);

    const data: IProjectListData = { projects };

    this.setState({ data, projects, isLoading: false });
  }
}

