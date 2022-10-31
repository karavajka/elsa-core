import {Component, Event, EventEmitter, h, Host, Method, Prop, State, Watch, Listen} from '@stencil/core';
import {v4 as uuid} from 'uuid';
import {
  addConnection,
  findActivity,
  getChildActivities,
  getInboundConnections,
  getOutboundConnections,
  Map,
  removeActivity,
  removeConnection,
  Hash
} from '../../utils/utils';
import {
  ActivityDescriptor,
  ActivityDesignDisplayContext,
  ActivityModel,
  ActivityTraits,
  ConnectionModel,
  EventTypes,
  WorkflowModel,
  WorkflowPersistenceBehavior,

  ActivityDefinitions,
  // GraphUpdatedArgs,
  // FlowchartNavigationItem,
  Flowchart,
  // ActivityDeletedArgs,
  // ContainerSelectedArgs,
  // ActivitySelectedArgs,
  // ConnectionCreatedEventArgs,
  // FlowchartEvents
} from '../../models';
import {eventBus,

  PortProviderRegistry,
  ActivityNode,
  walkActivities,
  createActivityLookup,
  flatten
} from '../../services';
import * as d3 from 'd3';
// import dagreD3 from 'dagre-d3';
import state from '../../utils/store';
import {ActivityIcon} from '../icons/activity-icon';
import {ActivityContextMenuState, LayoutDirection, WorkflowDesignerMode} from "../designers/tree/elsa-designer-tree/models";

import {first} from 'lodash';
import {createGraph} from './graph-factory';
import {Edge, Graph, Model, Node, NodeView, Point, Cell} from '@antv/x6';
import descriptorsStore from "../../data/descriptors-store";
// import  { generateUniqueActivityName } from "../../utils/generate-activity-name";
import  { ActivityNodeShape } from "./shapes";

const FlowchartTypeName = 'Elsa.Flowchart';

@Component({
  tag: 'elsa-designer-test',
  styleUrls: ['elsa-designer-test.css'],
  assetsDirs: ['assets'],
  shadow: false,
})
export class ElsaWorkflowDesigner {
  @Prop() model: WorkflowModel = {
    activities: [],
    connections: [],
    persistenceBehavior: WorkflowPersistenceBehavior.WorkflowBurst
  };
  @Prop() selectedActivityIds: Array<string> = [];
  @Prop() activityContextMenuButton?: (activity: ActivityModel) => string;
  @Prop() activityBorderColor?: (activity: ActivityModel) => string;
  @Prop() activityContextMenu?: ActivityContextMenuState;
  @Prop() connectionContextMenu?: ActivityContextMenuState;
  @Prop() activityContextTestMenu?: ActivityContextMenuState;
  @Prop() mode: WorkflowDesignerMode = WorkflowDesignerMode.Edit;
  @Prop() layoutDirection: LayoutDirection = LayoutDirection.TopBottom;
  @Prop({attribute: 'enable-multiple-connections'}) enableMultipleConnectionsFromSingleSource: boolean;
  @Event({
    eventName: 'workflow-changed',
    bubbles: true,
    composed: true,
    cancelable: true
  }) workflowChanged: EventEmitter<WorkflowModel>;
  @Event() activitySelected: EventEmitter<ActivityModel>;
  @Event() activityDeselected: EventEmitter<ActivityModel>;
  @Event() activityContextMenuButtonClicked: EventEmitter<ActivityContextMenuState>;
  @Event() connectionContextMenuButtonClicked: EventEmitter<ActivityContextMenuState>;
  @Event() activityContextMenuButtonTestClicked: EventEmitter<ActivityContextMenuState>;
  @State() workflowModel: WorkflowModel;

  @State() activityContextMenuState: ActivityContextMenuState = {
    shown: false,
    x: 0,
    y: 0,
    activity: null,
    selectedActivities: {}
  };

  @State() connectionContextMenuState: ActivityContextMenuState = {
    shown: false,
    x: 0,
    y: 0,
    activity: null,
  };

  @State() activityContextMenuTestState: ActivityContextMenuState = {
    shown: false,
    x: 0,
    y: 0,
    activity: null,
  };

  el: HTMLElement;
  // svg: SVGSVGElement;
  // inner: SVGGElement;
  // svgD3Selected: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  // innerD3Selected: d3.Selection<SVGGElement, unknown, null, undefined>;
  // zoomParams: { x: number; y: number; scale: number, initialZoom: boolean } = {x: 0, y: 0, scale: 1, initialZoom: true};
  // dagreD3Renderer: dagreD3.Render = new dagreD3.render();

  // graph: dagreD3.graphlib.Graph = new dagreD3.graphlib.Graph().setGraph({});
  // zoom: d3.ZoomBehavior<Element, unknown>;
  parentActivityId?: string;
  parentActivityOutcome?: string;
  addingActivity: boolean = false;
  activityDisplayContexts: Map<ActivityDesignDisplayContext> = null;
  oldActivityDisplayContexts: Map<ActivityDesignDisplayContext> = null;
  selectedActivities: Map<ActivityModel> = {};
  ignoreCopyPasteActivities: boolean = false;

  handleContextMenuChange(state: ActivityContextMenuState) {
    this.ignoreCopyPasteActivities = true;
    this.activityContextMenuState = state;
    this.activityContextMenuButtonClicked.emit(state);
  }

  handleConnectionContextMenuChange(state: ActivityContextMenuState) {
    this.connectionContextMenuState = state;
    this.connectionContextMenuButtonClicked.emit(state);
  }

  handleContextMenuTestChange(state: ActivityContextMenuState) {
    this.ignoreCopyPasteActivities = true;
    this.activityContextMenuTestState = state;
    this.activityContextMenuButtonTestClicked.emit(state);
  }

  @Watch('model')
  handleModelChanged(newValue: WorkflowModel) {
    this.updateWorkflowModel(newValue, false);
  }

  @Watch('selectedActivityIds')
  handleSelectedActivityIdsChanged(newValue: Array<string>) {
    const ids = newValue || [];
    const selectedActivities = this.workflowModel.activities.filter(x => ids.includes(x.activityId));
    const map: Map<ActivityModel> = {};

    for (const activity of selectedActivities)
      map[activity.activityId] = activity;

    this.selectedActivities = map;
    // this.safeRender();
  }

  @Watch('activityContextMenu')
  handleActivityContextMenuChanged(newValue: ActivityContextMenuState) {
    this.activityContextMenuState = newValue;
  }

  @Watch('connectionContextMenu')
  handleConnectionContextMenuChanged(newValue: ActivityContextMenuState) {
    this.connectionContextMenuState = newValue;
  }

  @Watch('activityContextTestMenu')
  handleActivityContextMenuTestChanged(newValue: ActivityContextMenuState) {
    this.activityContextMenuTestState = newValue;
  }

  // @Listen('keydown', {target: 'window'})
  // async handleKeyDown(event: KeyboardEvent) {
  //   if (this.ignoreCopyPasteActivities)
  //     return;
  //
  //   if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
  //     await this.copyActivitiesToClipboard();
  //   }
  //   if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
  //
  //     await this.pasteActivitiesFromClipboard();
  //   }
  // }

  @Method()
  async removeActivity(activity: ActivityModel) {
    this.removeActivityInternal(activity);
  }

  @Method()
  async removeSelectedActivities() {
    let model = {...this.workflowModel};

    Object.keys(this.selectedActivities).forEach((key) => {
      model = this.removeActivityInternal(this.selectedActivities[key], model);
    });

    this.updateWorkflowModel(model);
  }

  @Method()
  async showActivityEditor(activity: ActivityModel, animate: boolean) {
    await this.showActivityEditorInternal(activity, animate);
  }

  // async copyActivitiesToClipboard() {
  //   await navigator.clipboard.writeText(JSON.stringify(this.selectedActivities));
  //   await eventBus.emit(EventTypes.ClipboardCopied, this);
  // }

  // async pasteActivitiesFromClipboard() {
  //   let copiedActivities: Array<ActivityModel> = [];
  //
  //   await navigator.clipboard.readText().then(data => {
  //     copiedActivities = JSON.parse(data);
  //   });
  //   await this.addActivitiesFromClipboard(copiedActivities)
  // }

  //  ------ Start

  getOutcomes = (activity: ActivityModel, definition: ActivityDefinitions): Array<string> => {
    let outcomes = [];
    const displayContext = this.activityDisplayContexts[activity.activityId];

    if (!!definition) {
      const lambda = displayContext.outcomes || definition.outcomes;

      if (lambda instanceof Array) {
        outcomes = lambda as Array<string>;
      } else {
        const value = eval(lambda);

        if (value instanceof Array)
          outcomes = value;

        else if (value instanceof Function) {
          try {
            outcomes = value({ activity, definition, state: activity.state });
          } catch (e) {
            console.warn(e);
            outcomes = [];
          }
        }
      }
    }

    return !!outcomes ? outcomes : [];
  }

  private getActivitiesList(): Array<ActivityModel> {
    let newList = [];
    Object.entries(this.activityDisplayContexts).forEach(([key, value]) => newList.push(value));
    return newList;
  }

  private init = () => {
    const cells: Cell[] = []

    console.log("this.workflowModel:", this.workflowModel)

    this.workflowModel.connections.forEach((item: any) => {
        cells.push(this.graph.createEdge(
            {
              shape: 'elsa-edge',
              target: item.targetId,
              source: { cell: item.sourceId, port: item.outcome },
              labels:
              [{
                attrs: {
                  label: { text: item.outcome }
                },
              }],
              outcome: item.outcome,
          }
        ))
    })

    this.workflowModel.activities.forEach((item: any) => {
      const displayContext = this.activityDisplayContexts[item.activityId];
      const activityDefinitions: Array<ActivityDescriptor> = state.activityDescriptors;
      const definition = activityDefinitions.find(x => x.type == item.type);
      const outcomes: Array<string> = this.mode === WorkflowDesignerMode.Blueprint ? item.outcomes : this.getOutcomes(item, definition);

      let ports = [{group: 'in', id: uuid(), attrs: {}},]
      outcomes.forEach(outcome => ports.push({
        id: outcome,
        group: 'out',
        attrs: {
          text: {
            text: outcome
          },
        }
      }));

      cells.push(this.graph.createNode(
       { id: item.activityId,
          shape: 'activity',
          x: item.x || 0,
          y: item.y || 0,
          type: item.type,
          activity: item,
          ports: {
            items: ports
          },
          component: this.renderActivity(item),
          selectedActivities: this.selectedActivities,
          activityDescriptor: displayContext.activityDescriptor,
          displayContext: displayContext,
          activityDisplayContexts: this.activityDisplayContexts
       }
      ))
  })

    this.graph.resetCells(cells);
    this.graph.centerContent();
  }

  private readonly portProviderRegistry: PortProviderRegistry;
  private silent: boolean = false; // Whether to emit events or not.
  private activity: Flowchart;

  private disableEvents = () => this.silent = true;

  container: HTMLElement;
  graph: Graph;

  // @Event() activityDeleted: EventEmitter<ActivityDeletedArgs>;

  // @State() private currentPath: Array<FlowchartNavigationItem> = [];
  @State() private activityLookup: Hash<ActivityModel> = {};
  @State() private activityNodes: Array<ActivityNode> = [];

  // @Event() graphUpdated: EventEmitter<GraphUpdatedArgs>;
  // @Event() containerSelected: EventEmitter<ContainerSelectedArgs>;

  @Method()
  async updateLayout(): Promise<void> {
    const width = this.el.clientWidth;
    const height = this.el.clientHeight;
    this.graph.resize(width, height);
    this.graph.updateBackground();
  }


  async componentDidLoad() {
    await this.createAndInitializeGraph();
    this.init();
  }

  private enableEvents = async (emitWorkflowChanged: boolean): Promise<void> => {
    console.log("emitWorkflowChanged === true:", emitWorkflowChanged === true)
    this.silent = false;

    if (emitWorkflowChanged === true) {
      // await this.onGraphChanged();
    }
  };

  private createAndInitializeGraph = async () => {
    const graph = this.graph = createGraph(this.container, {
        // nodeMovable: () => this.interactiveMode,
        // edgeMovable: () => this.interactiveMode,
        // arrowheadMovable: () => this.interactiveMode,
        // edgeLabelMovable: () => this.interactiveMode,
        // magnetConnectable: () => this.interactiveMode,
        // useEdgeTools: () => this.interactiveMode,
        // toolsAddable: () => this.interactiveMode,
        // stopDelegateOnDragging: () => this.interactiveMode,
        // vertexAddable: () => this.interactiveMode,
        // vertexDeletable: () => this.interactiveMode,
        // vertexMovable: () => this.interactiveMode,
        nodeMovable: () => true,
        edgeMovable: () => true,
        arrowheadMovable: () => true,
        edgeLabelMovable: () => true,
        magnetConnectable: () => true,
        useEdgeTools: () => true,
        toolsAddable: () => true,
        stopDelegateOnDragging: () => true,
        vertexAddable: () => true,
        vertexDeletable: () => true,
        vertexMovable: () => true,
      },
      this.disableEvents,
      this.enableEvents);

    graph.on('blank:click', this.onGraphClick);
    graph.on('node:click', this.onNodeClick);
    graph.on('node:contextmenu', this.onNodeContextMenu);
    graph.on('edge:connected', this.onEdgeConnected);
    graph.on('edge:removed', this.connectionDetachedTest);
    // graph.on('edge:removed', this.onGraphChanged);
    graph.on('node:moved', this.onNodeMoved);
    // graph.on('edge:click', this.onEdgeClick);

    graph.on('node:change:*', this.onGraphChanged);
    graph.on('node:added', this.onGraphChanged);
    graph.on('node:removed', this.onNodeRemoved);
    graph.on('node:removed', this.onGraphChanged);
    // graph.on('edge:added', this.onGraphChanged);
    // graph.on('edge:removed', this.onGraphChanged);
    // graph.on('edge:connected', this.onGraphChanged);

    await this.updateLayout();
  }

  // private onEdgeClick =async (e) => {
  //   console.log("edge e:", e)

  //   const edge = e.edge;
  //   let workflowModel = {...this.workflowModel};
  //   const sourceNode = edge.getSourceCellId();
  //   const targetNode = edge.getTargetCellId();
  //   const outcome: string = edge.getSourcePortId();
  //   workflowModel = this.removeConnectionTest(workflowModel, sourceNode, outcome);
  //   this.updateWorkflowModel(workflowModel);
  // }

 private removeConnectionTest(workflowModel: WorkflowModel, sourceId: string, outcome: string): WorkflowModel {
    return {
      ...workflowModel,
      connections: workflowModel.connections.filter(x => !(x.sourceId === sourceId && x.outcome === outcome))
    };
  }

  private onNodeMoved = async (e) => {
    const node = e.node as ActivityNodeShape;
    const activity = node.activity as ActivityModel;
    const nodePosition = node.position({relative: false});

    activity.x = nodePosition.x;
    activity.y = nodePosition.y;

    this.updateActivity(activity);
  }

  private onNodeClick = async (e) => {
    const node = e.node as ActivityNodeShape;
    const activity = node.activity as ActivityModel;
    console.log("e.node", e.node)

    // const args: ActivitySelectedArgs = {
    //   activity: activity,
    // };
    // this.activitySelected.emit(args);

     // If a parent activity was selected to connect to:
     if (this.mode == WorkflowDesignerMode.Edit && this.parentActivityId && this.parentActivityOutcome) {
      this.addConnection(this.parentActivityId, node.id, this.parentActivityOutcome);
    } else {
      // When clicking an activity with shift:
      if (e.e.shiftKey) {
        if (!!this.selectedActivities[activity.activityId])
          delete this.selectedActivities[activity.activityId];
        else {
          this.selectedActivities[activity.activityId] = activity;
          this.activitySelected.emit(activity);
        }
      }
      // When clicking an activity:
      else {
        if (!!this.selectedActivities[activity.activityId])
          delete this.selectedActivities[activity.activityId];
        else {
          for (const key in this.selectedActivities) {
            this.activityDeselected.emit(this.selectedActivities[key]);
          }
          this.selectedActivities = {};
          this.selectedActivities[activity.activityId] = activity;
          this.activitySelected.emit(activity);
        }
      }

      // // Delay the rerender of the tree to permit the double click action to be captured
      // setTimeout(() => {
      //   // this.safeRender();
      // }, 90);
    }

    if (this.mode == WorkflowDesignerMode.Edit || this.mode == WorkflowDesignerMode.Instance) {

      //  '.context-menu-button-container button'
      e.e.stopPropagation();
      this.handleContextMenuChange({
        x: e.e.clientX,
        y: e.e.clientY,
        shown: true,
        activity: node.activity,
        selectedActivities: this.selectedActivities
      });
      console.log("this.selectedActivities:", this.selectedActivities)
    }

    if (this.mode == WorkflowDesignerMode.Test) {

        //'.context-menu-button-container button'
        //   e.stopPropagation();
        //   this.handleContextMenuTestChange({x: e.clientX, y: e.clientY, shown: true, activity: node.activity});
    }
  };

  private onNodeContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.parentActivityId = e.node.activity.activityId;
    this.parentActivityOutcome = e.node.outcome;
    this.handleConnectionContextMenuChange({x: e.clientX, y: e.clientY, shown: true, activity: e.node.activity});
  }

  // private onGraphClick = async (e: PositionEventArgs<JQuery.ClickEvent>) => {
  //   const currentContainer = this.getCurrentContainerInternal();

  //   const args: ContainerSelectedArgs = {
  //     activity: currentContainer,
  //   };
  //   return this.containerSelected.emit(args);
  // };

  private onGraphClick = async () => {
    // const currentContainer = this.getCurrentContainerInternal();

    // const args: ContainerSelectedArgs = {
    //   activity: currentContainer,
    // };
    // return this.containerSelected.emit(args);
  };

  private onGraphChanged = async (e) => {
    // if (this.silent) {
    //   await this.enableEvents(false);
    //   return;
    // }


    // await this.updateModel();
    // this.graphUpdated.emit();
    await this.updateLayout();
  }

  addConnectionTest(sourceActivityId: string, targetActivityId: string, outcome: string) {
    const workflowModel = {...this.workflowModel};
    const newConnection: ConnectionModel = {
      sourceId: sourceActivityId,
      targetId: targetActivityId,
      outcome: outcome};
    let connections = workflowModel.connections;

    if (!this.enableMultipleConnectionsFromSingleSource)
      connections = [...workflowModel.connections.filter(x => !(x.sourceId === sourceActivityId && x.outcome === outcome))];

    workflowModel.connections = [...connections, newConnection];
    this.updateWorkflowModel(workflowModel);
    this.parentActivityId = null;
    this.parentActivityOutcome = null;
  }

  private connectionDetachedTest = async (e: { edge: Edge }) => {
    const edge = e.edge;
    let workflowModel = {...this.workflowModel};
    const sourceId = edge.getSourceCellId();
    // const targetNode = edge.getTargetCellId();
    const outcome: string = edge.getSourcePortId();
    workflowModel = this.removeConnectionTest(workflowModel, sourceId, outcome);
    this.updateWorkflowModel(workflowModel);
  };

  private onEdgeConnected = async (e: { edge: Edge }) => {
    const edge = e.edge;
    let workflowModel = {...this.workflowModel};

    const sourceNode = edge.getSourceNode();
    const targetId = edge.getTargetCellId();
    const sourcePort = edge.getSourcePortId();

    this.addConnectionTest(sourceNode.id, targetId, sourcePort);

    if (!this.enableMultipleConnectionsFromSingleSource) {
      const existingConnection = workflowModel.connections.find(x => x.sourceId === sourceNode.id && x.targetId == targetId);

      if (!existingConnection) {
        // Add created connection to list.
        const newConnection: ConnectionModel = {
          sourceId: sourceNode.id,
          targetId: targetId,
          outcome: sourcePort
        };

        edge.insertLabel(sourcePort)

        workflowModel.connections = [...workflowModel.connections, newConnection];
        this.updateWorkflowModel(workflowModel);
      }
  }}

  private updateModel = async () => {
    // const model = this.getFlowchartModel();
    // console.log("model:", model)
    // let currentLevel = this.getCurrentContainerInternal();

    // console.log("currentLevel:", currentLevel)
    // if (!currentLevel) {
    //   currentLevel = await this.createContainer();
    // }

    // currentLevel.activities = model.activities;
    // currentLevel.connections = model.connections;
    // currentLevel.start = model.start;

    // const currentPath = this.currentPath;
    // const currentNavigationItem = currentPath[currentPath.length - 1];
    // const currentPortName = currentNavigationItem?.portName;
    // const currentScope = this.activityLookup[currentNavigationItem.activityId] as ActivityModel;
    // const currentScopeDescriptor = this.getActivityDescriptor(currentScope.type);

    // console.log("currentPortName:", currentPortName)

    // if (!!currentPortName) {
    //   const portProvider = this.portProviderRegistry.get(currentScope.type);
    //   portProvider.assignPort(currentPortName, currentLevel, {activity: currentScope, activityDescriptor: currentScopeDescriptor});
    // } else {
    //   this.activity = currentLevel;
    // }

    this.updateLookups();
  }

  private getActivityDescriptor = (typeName: string): ActivityDescriptor => {
    return descriptorsStore.activityDescriptors.find(x => x.type == typeName)}

  private getFlowchartDescriptor = () => this.getActivityDescriptor(FlowchartTypeName);

  private createContainer = async (): Promise<Flowchart> => {
    const descriptor = this.getFlowchartDescriptor();
    const activityId = await this.generateUniqueActivityName(descriptor);

    return {
      type: descriptor.type,
      version: descriptor.version,
      activityId: activityId,
      start: null,
      activities: [],
      connections: [],
      metadata: {},
      variables: [],
      applicationProperties: {},
      // canStartWorkflow: false
    };
  }

  // private getFlowchartModel = (): WorkflowModel => {
  //   const graph = this.graph;
  //   const graphModel = graph.toJSON();
  //   const activities = graphModel.cells.filter(x => x.shape == 'activity').map(x => x.data as ActivityModel);
  //   const connections = graphModel.cells.filter(x => x.shape == 'elsa-edge' && !!x.data).map(x => x.data as ConnectionModel);

  //   let rootActivities = activities.filter(activity => {
  //     const hasInboundConnections = connections.find(c => c.targetId == activity.activityId) != null;
  //     return !hasInboundConnections;
  //   });

  //   const startActivity = first(rootActivities);

  //   return {
  //     activities,
  //     connections,
  //     start: startActivity?.id
  //   };
  // };

  // private getCurrentContainerInternal(): Flowchart {
  //   const currentItem = this.currentPath.length > 0 ? this.currentPath[this.currentPath.length - 1] : null;

  //   if (!currentItem)
  //     return this.activity;

  //   const activity = this.activityLookup[currentItem.activityId] as Flowchart;
  //   const activityDescriptor = descriptorsStore.activityDescriptors.find(x => x.type == activity.type);

  //   if (activityDescriptor.isContainer)
  //     return activity;

  //   const portProvider = this.portProviderRegistry.get(activity.type);
  //   return portProvider.resolvePort(currentItem.portName, {activity, activityDescriptor}) as Flowchart;
  // }

  private generateUniqueActivityName = async (activityDescriptor: ActivityDescriptor): Promise<string> => {
    // console.log("generateUniqueActivityName activityDescriptor:", activityDescriptor)
    // console.log("generateUniqueActivityName this.activityNodes:", this.activityNodes)
    // return await generateUniqueActivityName(this.activityNodes, activityDescriptor);
    return ''
  };

  private updateLookups = () => {
    this.activityNodes = flatten(walkActivities(this.activity));
    this.activityLookup = createActivityLookup(this.activityNodes);
  }


  private onNodeRemoved = (e: any) => {
    const activity = e.node.data as ActivityModel;
    // this.activityDeleted.emit({activity});
  };

  private onDeleteActivityClicked = (node: ActivityNodeShape) => {
    let cells = this.graph.getSelectedCells();

    if (cells.length == 0)
      cells = [node];

    this.graph.removeCells(cells);

    for (const cell of cells) {
      const activity = node.data as ActivityModel;
      // this.activityDeleted.emit({activity: activity});
    }
  };

  async onAddActivity(e: Event) {
    e.preventDefault();
    if (this.mode !== WorkflowDesignerMode.Test) await this.showActivityPicker();
  }

  //  -------

  // private connectionCreated = async (info: any) => {

  //   const workflowModel = {...this.workflowModel};
  //   const connection = info.connection;
  //   const sourceEndpoint: any = info.sourceEndpoint;
  //   const outcome: string = sourceEndpoint.getParameter('outcome');
  //   const label: any = connection.getOverlay('label');

  //   label.setLabel(outcome);

  //   // Check if we already have this connection.
  //   const sourceActivity: ActivityModel = this.findActivityByElement(info.source);
  //   const destinationActivity: ActivityModel = this.findActivityByElement(info.target);

  //   if (!this.enableMultipleConnectionsFromSingleSource) {
  //     const existingConnection = workflowModel.connections.find(x => x.sourceId === sourceActivity.activityId && x.targetId == destinationActivity.activityId);

  //     if (!existingConnection) {
  //       // Add created connection to list.
  //       const newConnection: ConnectionModel = {
  //         sourceId: sourceActivity.activityId,
  //         targetId: destinationActivity.activityId,
  //         outcome: outcome
  //       };

  //       workflowModel.connections = [...workflowModel.connections, newConnection];
  //       this.updateWorkflowModel(workflowModel);
  //     }
  //   }
  // };

  private findActivityByElement = (element: Element): ActivityModel => {
    const id =  ElsaWorkflowDesigner.getActivityId(element);
    return this.findActivityById(id);
  };

  private static getActivityId(element: Element): string {
    return element.attributes['data-cell-id'].value;
  }

  private findActivityById = (id: string): ActivityModel => this.workflowModel.activities.find(x => x.activityId === id);

  // private connectionDetached = async (info: any) => {
  //   let workflowModel = {...this.workflowModel};
  //   const sourceEndpoint: any = info.sourceEndpoint;
  //   const outcome: string = sourceEndpoint.getParameter('outcome');
  //   const sourceActivity: ActivityModel = this.findActivityByElement(info.source);
  //   const destinationActivity: ActivityModel = this.findActivityByElement(info.target);
  //   workflowModel = removeConnection(workflowModel, sourceActivity.activityId, outcome);
  //   this.updateWorkflowModel(workflowModel);
  // };

  // private updateActivityInternal = async (activity: ActivityModel) => {
  //   const activities = [...this.workflowModel.activities];
  //   const index = activities.findIndex(x => x.activityId == activity.activityId);

  //   activities[index] = { ...activity };

  //   this.workflowModel = { ...this.workflowModel, activities };
  // };

  //  ------ End

  async addActivitiesFromClipboard(copiedActivities: Array<ActivityModel>) {
    let sourceActivityId: string;
    this.parentActivityId = null;
    this.parentActivityOutcome = null;

    for (const key in this.selectedActivities) {
      sourceActivityId = this.selectedActivities[key].activityId;
    }

    if (sourceActivityId != undefined) {
      this.parentActivityId = sourceActivityId;
      this.parentActivityOutcome = this.selectedActivities[sourceActivityId].outcomes[0];
    }

    for (const key in copiedActivities) {
      this.addingActivity = true;
      copiedActivities[key].activityId = uuid();

      await eventBus.emit(EventTypes.UpdateActivity, this, copiedActivities[key]);

      this.parentActivityId = copiedActivities[key].activityId;
      this.parentActivityOutcome = copiedActivities[key].outcomes[0];
    }

    this.selectedActivities = {};
    // Set to null to avoid conflict with on Activity node click event
    this.parentActivityId = null;
    this.parentActivityOutcome = null;
  }

  connectedCallback() {
    eventBus.on(EventTypes.ActivityPicked, this.onActivityPicked);
    eventBus.on(EventTypes.UpdateActivity, this.onUpdateActivity);
    //eventBus.on(EventTypes.PasteActivity, this.onPasteActivity);
    // eventBus.on(EventTypes.HideModalDialog, this.onCopyPasteActivityEnabled);
    // eventBus.on(EventTypes.ShowWorkflowSettings, this.onCopyPasteActivityDisabled);
    eventBus.on(EventTypes.WorkflowExecuted, this.onWorkflowExecuted);
  }

  disconnectedCallback() {
    eventBus.detach(EventTypes.ActivityPicked, this.onActivityPicked);
    eventBus.detach(EventTypes.UpdateActivity, this.onUpdateActivity);
    //eventBus.detach(EventTypes.PasteActivity, this.onPasteActivity);
    // eventBus.detach(EventTypes.HideModalDialog, this.onCopyPasteActivityEnabled);
    // eventBus.detach(EventTypes.ShowWorkflowSettings, this.onCopyPasteActivityDisabled);
    eventBus.detach(EventTypes.WorkflowExecuted, this.onWorkflowExecuted);
    d3.selectAll('.node').on('click', null);
    d3.selectAll('.edgePath').on('contextmenu', null);
  }

  componentWillLoad() {
    this.workflowModel = this.model;
  }

  // componentDidLoad() {
  //   this.svgD3Selected = d3.select(this.svg);
  //   this.innerD3Selected = d3.select(this.inner);
  //   this.safeRender();
  // }

  // safeRender() {
  //   // Rebuild D3 model if component completed its initial load.
  //   if (!this.svgD3Selected)
  //     return;

  //   const rect = this.el.getBoundingClientRect();
  //   if (rect.height === 0 || rect.width === 0) {
  //     const observer = new ResizeObserver(entries => {
  //       for (let entry of entries) {
  //         // this.renderTree();
  //         observer.unobserve(this.el);
  //       }
  //     });

  //     observer.observe(this.el);
  //   } else {
  //     // this.renderTree();
  //   }
  // }

  async componentWillRender() {
    if (!!this.activityDisplayContexts)
      return;

    const activityModels = this.workflowModel.activities;
    const displayContexts: Map<ActivityDesignDisplayContext> = {};

    for (const model of activityModels)
      displayContexts[model.activityId] = await this.getActivityDisplayContext(model);

    this.activityDisplayContexts = displayContexts;
    // this.safeRender();
  }

  async getActivityDisplayContext(activityModel: ActivityModel): Promise<ActivityDesignDisplayContext> {
    const activityDescriptors: Array<ActivityDescriptor> = state.activityDescriptors;
    let descriptor = activityDescriptors.find(x => x.type == activityModel.type);
    let descriptorExists = !!descriptor;
    const oldContextData = (this.oldActivityDisplayContexts && this.oldActivityDisplayContexts[activityModel.activityId]) || {expanded: false};

    if (!descriptorExists)
      descriptor = this.createNotFoundActivityDescriptor(activityModel);

    const description = descriptorExists ? activityModel.description : `(Not Found) ${descriptorExists}`;
    const bodyText = description && description.length > 0 ? description : undefined;
    const bodyDisplay = bodyText ? `<p>${bodyText}</p>` : undefined;
    const color = (descriptor.traits &= ActivityTraits.Trigger) == ActivityTraits.Trigger ? 'rose' : 'sky';
    const displayName = descriptorExists ? activityModel.displayName : `(Not Found) ${activityModel.displayName}`;

    const displayContext: ActivityDesignDisplayContext = {
      activityModel: activityModel,
      activityDescriptor: descriptor,
      activityIcon: <ActivityIcon color={color}/>,
      bodyDisplay: bodyDisplay,
      displayName: displayName,
      outcomes: [...activityModel.outcomes],
      expanded: oldContextData.expanded
    };

    await eventBus.emit(EventTypes.ActivityDesignDisplaying, this, displayContext);
    return displayContext;
  }

  createNotFoundActivityDescriptor(activityModel: ActivityModel): ActivityDescriptor {
    return {
      outcomes: ['Done'],
      inputProperties: [],
      type: `(Not Found) ${activityModel.type}`,
      outputProperties: [],
      displayName: `(Not Found) ${activityModel.displayName || activityModel.name || activityModel.type}`,
      traits: ActivityTraits.Action,
      description: `(Not Found) ${activityModel.description}`,
      category: 'Not Found',
      browsable: false,
      customAttributes: {}
    };
  }

  async showActivityEditorInternal(activity: ActivityModel, animate: boolean) {
    await eventBus.emit(EventTypes.ActivityEditor.Show, this, activity, animate);
  }

  updateWorkflowModel(model: WorkflowModel, emitEvent: boolean = true) {
    this.workflowModel = this.cleanWorkflowModel(model);
    this.oldActivityDisplayContexts = this.activityDisplayContexts;
    this.activityDisplayContexts = null;

    if (emitEvent)
      this.workflowChanged.emit(model);
  }

  cleanWorkflowModel(model: WorkflowModel): WorkflowModel {

    // Detect duplicate activities and throw.
    const activityIds = model.activities.map(x => x.activityId);
    const count = ids => ids.reduce((a, b) => ({...a, [b]: (a[b] || 0) + 1}), {})
    const duplicates = dict => Object.keys(dict).filter((a) => dict[a] > 1)
    const duplicateIds = duplicates(count(activityIds));

    if (duplicateIds.length > 0) {
      console.error(duplicateIds);
      throw Error(`Found duplicate activities. Throwing for now until we find the root cause.`);
    }

    model.connections = model.connections.filter(connection => {
      const sourceId = connection.sourceId;
      const targetId = connection.targetId;
      const sourceExists = model.activities.findIndex(x => x.activityId == sourceId) != null;
      const targetExists = model.activities.findIndex(x => x.activityId == targetId) != null;

      if (!sourceExists)
        connection.sourceId = null;

      if (!targetExists)
        connection.targetId = null;

      return !!connection.sourceId || !!connection.targetId;
    });

    return model;
  }

  removeActivityInternal(activity: ActivityModel, model?: WorkflowModel) {
    let workflowModel = model || {...this.workflowModel};
    const incomingConnections = getInboundConnections(workflowModel, activity.activityId);
    const outgoingConnections = getOutboundConnections(workflowModel, activity.activityId);

    // Remove activity (will also remove its connections).
    workflowModel = removeActivity(workflowModel, activity.activityId);

    // For each incoming activity, try to connect it to an outgoing activity based on outcome.
    if (outgoingConnections.length > 0 && incomingConnections.length > 0) {
      for (const incomingConnection of incomingConnections) {
        const incomingActivity = findActivity(workflowModel, incomingConnection.sourceId);
        let outgoingConnection = outgoingConnections.find(x => x.outcome === incomingConnection.outcome);

        // If not matching outcome was found, pick the first one. The user will have to manually reconnect to the desired outcome.
        if (!outgoingConnection)
          outgoingConnection = outgoingConnections[0];

        if (!!outgoingConnection)
          workflowModel = addConnection(workflowModel, {
            sourceId: incomingActivity.activityId,
            targetId: outgoingConnection.targetId,
            outcome: incomingConnection.outcome
          });
      }
    }

    delete this.selectedActivities[activity.activityId];

    if (!model) {
      this.updateWorkflowModel(workflowModel);
    }

    return workflowModel;
  }

  newActivity(activityDescriptor: ActivityDescriptor): ActivityModel {
    const activity: ActivityModel = {
      activityId: uuid(),
      type: activityDescriptor.type,
      outcomes: activityDescriptor.outcomes,
      displayName: activityDescriptor.displayName,
      properties: [],
      propertyStorageProviders: {}
    };

    for (const property of activityDescriptor.inputProperties) {
      activity.properties[property.name] = {
        syntax: '',
        expression: '',
      };
    }

    return activity;
  }

  async addActivity(activity: ActivityModel, sourceActivityId?: string, targetActivityId?: string, outcome?: string) {
    outcome = outcome || 'Done';

    const workflowModel = {...this.workflowModel, activities: [...this.workflowModel.activities, activity]};
    const activityDisplayContext = await this.getActivityDisplayContext(activity);

    if (targetActivityId) {
      const existingConnection = workflowModel.connections.find(x => x.targetId == targetActivityId && x.outcome == outcome);

      if (existingConnection) {
        workflowModel.connections = workflowModel.connections.filter(x => x != existingConnection);

        const replacementConnection = {
          ...existingConnection,
          sourceId: activity.activityId,
        };

        workflowModel.connections.push(replacementConnection);
      } else {
        workflowModel.connections.push({sourceId: activity.activityId, targetId: targetActivityId, outcome: outcome});
      }
    }

    if (sourceActivityId != null) {
      const existingConnection = workflowModel.connections.find(x => x.sourceId == sourceActivityId && x.outcome == outcome);

      if (existingConnection != null) {
        // Remove the existing connection
        workflowModel.connections = workflowModel.connections.filter(x => x != existingConnection);

        // Create a new outbound connection between the source and the added activity.
        const newOutboundConnection: ConnectionModel = {
          sourceId: existingConnection.sourceId,
          targetId: activity.activityId,
          outcome: existingConnection.outcome
        };

        workflowModel.connections.push(newOutboundConnection);

        // Create a new outbound activity between the added activity and the target of the source activity.
        const connection: ConnectionModel = {
          sourceId: activity.activityId,
          targetId: existingConnection.targetId,
          outcome: activityDisplayContext.outcomes[0]
        };

        workflowModel.connections.push(connection);
      } else {
        const connection: ConnectionModel = {
          sourceId: sourceActivityId,
          targetId: activity.activityId,
          outcome: outcome
        };
        workflowModel.connections.push(connection);
      }
    }

    this.updateWorkflowModel(workflowModel);
    this.parentActivityId = null;
    this.parentActivityOutcome = null;
  }

  getRootActivities(): Array<ActivityModel> {
    return getChildActivities(this.workflowModel, null);
  }

  addConnection(sourceActivityId: string, targetActivityId: string, outcome: string) {
    const workflowModel = {...this.workflowModel};
    const newConnection: ConnectionModel = {sourceId: sourceActivityId, targetId: targetActivityId, outcome: outcome};
    let connections = workflowModel.connections;

    if (!this.enableMultipleConnectionsFromSingleSource)
      connections = [...workflowModel.connections.filter(x => !(x.sourceId === sourceActivityId && x.outcome === outcome))];

    workflowModel.connections = [...connections, newConnection];
    this.updateWorkflowModel(workflowModel);
    this.parentActivityId = null;
    this.parentActivityOutcome = null;
  }

  updateActivity(activity: ActivityModel) {
    let workflowModel = {...this.workflowModel};
    const activities = [...workflowModel.activities];
    const index = activities.findIndex(x => x.activityId === activity.activityId);
    activities[index] = activity;
    this.updateWorkflowModel({...workflowModel, activities: activities});
  }

  async showActivityPicker() {
    await eventBus.emit(EventTypes.ShowActivityPicker);
  }

  removeConnection(sourceId: string, outcome: string) {
    let workflowModel = {...this.workflowModel};
    workflowModel = removeConnection(workflowModel, sourceId, outcome);
    this.updateWorkflowModel(workflowModel);
  }

  // applyZoom() {
  //   this.zoom = d3.zoom().on('zoom', event => {
  //     const {transform} = event;
  //     // this.innerD3Selected.attr('transform', transform);
  //     this.zoomParams = {
  //       x: transform.x,
  //       y: transform.y,
  //       scale: transform.k,
  //       initialZoom: this.zoomParams.initialZoom,
  //     };
  //   });
  //   // this.svgD3Selected.call(this.zoom);
  // }

  // applyInitialZoom() {
  //   const {width: widthSvg}: { width: number } = this.svgD3Selected.node().getBBox();
  //   const middleScreen: number = this.svgD3Selected.node().clientWidth / 2;
  //   const nodeStartTransform: string = d3.select('.node.start').attr('transform');
  //   const nodeStartTranslateX: number = parseInt(nodeStartTransform.replace(/translate|((\)|\())/g, '').split(',')[0]);

  //   const zoomParamsScale: number = 1;
  //   const zoomParamsY: number = 50;
  //   const zoomParamsX: number = middleScreen - (widthSvg - (widthSvg - nodeStartTranslateX));

  //   this.zoom.scaleTo(this.svgD3Selected, zoomParamsScale);
  //   this.zoom.translateTo(this.svgD3Selected, zoomParamsX, zoomParamsY);

  //   this.svgD3Selected
  //     .call(this.zoom.transform, d3.zoomIdentity.scale(zoomParamsScale)
  //       .translate(zoomParamsX, zoomParamsY));

  //   this.zoomParams.initialZoom = false;
  // }

  // setEntities() {
  //   this.graph = new dagreD3.graphlib.Graph().setGraph({ranksep: 30});
  //   (this.graph.graph() as any).rankdir = this.getLayoutDirection();

  //   const rootActivities = this.getRootActivities();

  //   // Start node.
  //   this.graph.setNode('start', {
  //     shape: 'rect',
  //     label: this.mode == WorkflowDesignerMode.Edit
  //       ? `<button class="elsa-px-6 elsa-py-3 elsa-border elsa-border-transparent elsa-text-base elsa-leading-6 elsa-font-medium elsa-rounded-md elsa-text-white elsa-bg-green-600 hover:elsa-bg-green-500 focus:elsa-outline-none focus:elsa-border-green-700 focus:elsa-shadow-outline-green active:elsa-bg-green-700 elsa-transition elsa-ease-in-out elsa-duration-150">Start</button>`
  //       : `<button class="elsa-px-6 elsa-py-3 elsa-border elsa-border-transparent elsa-text-base elsa-leading-6 elsa-font-medium elsa-rounded-md elsa-text-white elsa-bg-green-600 focus:elsa-outline-none elsa-cursor-default">Start</button>`,
  //     rx: 5,
  //     ry: 5,
  //     labelType: 'html',
  //     class: 'start',
  //   });

  //   // Connections between Start and root activities.
  //   rootActivities.forEach(activity => {
  //     this.graph.setEdge('start', `${activity.activityId}/start`, {
  //       arrowhead: 'undirected',
  //     });
  //     this.graph.setNode(`${activity.activityId}/start`, {
  //       shape: 'rect',
  //       activity,
  //       label: this.renderOutcomeButton(),
  //       labelType: 'html',
  //       class: 'add'
  //     });
  //     this.graph.setEdge(`${activity.activityId}/start`, activity.activityId, {arrowhead: 'undirected'});
  //   });

  //   // Connections between activities and their outcomes.
  //   const activityDisplayContexts = this.activityDisplayContexts || {};

  //   this.workflowModel.activities.forEach(activity => {

  //     this.graph.setNode(activity.activityId, this.createActivityOptions(activity));
  //     const displayContext = activityDisplayContexts[activity.activityId] || undefined;
  //     const outcomes = !!displayContext ? displayContext.outcomes : activity.outcomes || [];

  //     outcomes.forEach(outcome => {
  //       this.graph.setNode(`${activity.activityId}/${outcome}`, {
  //         shape: 'rect',
  //         outcome,
  //         activity,
  //         label: this.renderOutcomeButton(),
  //         labelType: 'html',
  //         class: 'add'
  //       });
  //       this.graph.setEdge(activity.activityId, `${activity.activityId}/${outcome}`, {
  //         label: `<p class="elsa-outcome elsa-mb-4 elsa-relative elsa-z-10 elsa-px-2.5 elsa-py-0.5 elsa-rounded-full elsa-text-xs elsa-font-medium elsa-leading-4 elsa-bg-gray-100 elsa-text-gray-800 elsa-capitalize elsa-cursor-default">${outcome}</p>`,
  //         labelpos: 'c',
  //         labelType: 'html',
  //         arrowhead: 'undirected',
  //       });
  //     });
  //   });

  //   this.workflowModel.connections.forEach(({sourceId, targetId, outcome}) => {
  //     const sourceName = `${sourceId}/${outcome}`;

  //     if (!this.graph.hasNode(sourceName)) {
  //       console.warn(`No source node with ID '${sourceName}' exists.`);
  //       return;
  //     }

  //     this.graph.setEdge(sourceName, targetId, {arrowhead: 'undirected'});
  //   });
  // }

  onActivityPicked = async args => {
    const activityDescriptor = args as ActivityDescriptor;
    const activityModel = this.newActivity(activityDescriptor);
    this.addingActivity = true;
    await this.showActivityEditorInternal(activityModel, false);
  };

  onUpdateActivity = args => {
    const activityModel = args as ActivityModel;

    if (this.addingActivity) {
      console.debug(`adding activity with ID ${activityModel.activityId}`)
      const connectFromRoot = !this.parentActivityOutcome || this.parentActivityOutcome == '';
      const sourceId = connectFromRoot ? null : this.parentActivityId;
      const targetId = connectFromRoot ? this.parentActivityId : null;
      this.addActivity(activityModel, sourceId, targetId, this.parentActivityOutcome);
      this.addingActivity = false;
    } else {
      console.debug(`updating activity with ID ${activityModel.activityId}`)
      this.updateActivity(activityModel);
    }
  };

  // onPasteActivity = async args => {
  //   const activityModel = args as ActivityModel;
  //
  //   this.selectedActivities = {};
  //   activityModel.outcomes[0] = this.parentActivityOutcome;
  //   this.selectedActivities[activityModel.activityId] = activityModel;
  //   await this.pasteActivitiesFromClipboard();
  // };
  //
  // onCopyPasteActivityEnabled = () => {
  //   this.ignoreCopyPasteActivities = false
  // }
  //
  // onCopyPasteActivityDisabled = () => {
  //   this.ignoreCopyPasteActivities = true
  // }

  onWorkflowExecuted = () => {
    // const firstNode = d3.select(this.el).select('.node.activity');

    // const node = this.graph.node(firstNode.data() as any) as any;
    // const activity = node.activity;
    // const activityId = activity.activityId;

    // this.selectedActivities[activityId] = activity;
    // this.activitySelected.emit(activity);
  }

  // renderNodes() {
  //   const prevTransform = this.innerD3Selected.attr('transform');
  //   const scaleAfter = this.zoomParams.scale;
  //   const root = d3.select(this.el);
  //   this.svgD3Selected.call(this.zoom.scaleTo, 1);
  //   this.dagreD3Renderer(this.innerD3Selected as any, this.graph as any);
  //   this.svgD3Selected.call(this.zoom.scaleTo, scaleAfter);
  //   this.innerD3Selected.attr('transform', prevTransform);

  //   if (this.zoomParams.initialZoom === true) {
  //     this.applyInitialZoom();
  //   }

  //   if (this.mode == WorkflowDesignerMode.Edit) {
  //     root.selectAll('.node.add').each((n: any) => {
  //       const node = this.graph.node(n) as any;

  //       d3.select(node.elem)
  //         .on('click', async e => {
  //           e.preventDefault();
  //           root.selectAll('.node.add svg').classed('elsa-text-green-400', false).classed('elsa-text-gray-400', true).classed('hover:elsa-text-blue-500', true);
  //           this.parentActivityId = node.activity.activityId;
  //           this.parentActivityOutcome = node.outcome;

  //           if (e.shiftKey) {
  //             d3.select(node.elem).select('svg').classed('elsa-text-green-400', true).classed('elsa-text-gray-400', false).classed('hover:elsa-text-blue-500', false);
  //             return;
  //           }

  //           if (this.mode !== WorkflowDesignerMode.Test) await this.showActivityPicker();
  //         })
  //         .on("mouseover", e => {
  //           if (e.shiftKey)
  //             d3.select(node.elem).select('svg').classed('elsa-text-green-400', true).classed('hover:elsa-text-blue-500', false);
  //         })
  //         .on("mouseout", e => {
  //           d3.select(node.elem).select('svg').classed('elsa-text-green-400', false).classed('hover:elsa-text-blue-500', true);
  //         })
  //         .on('contextmenu', e => {
  //           e.preventDefault();
  //           e.stopPropagation();
  //           this.parentActivityId = node.activity.activityId;
  //           this.parentActivityOutcome = node.outcome;
  //           this.handleConnectionContextMenuChange({x: e.clientX, y: e.clientY, shown: true, activity: node.activity});
  //         });
  //     });

  //     root.selectAll('.node.start').each((n: any) => {
  //       const node = this.graph.node(n) as any;
  //       d3.select(node.elem).on('click', async e => {
  //         if (this.mode == WorkflowDesignerMode.Test) return;

  //         await this.showActivityPicker();
  //       });
  //     });

  //     root.selectAll('.edgePath').append(appendClickableEl).attr('class', 'label-clickable');

  //     function appendClickableEl() {
  //       const originalD = this.querySelector('.path').getAttribute('d');
  //       const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  //       newPath.setAttribute('d', originalD);
  //       return this.appendChild(newPath);
  //     }

  //     root.selectAll('.edgePath').each((edg: any) => {
  //       const edge = this.graph.edge(edg) as any;
  //       d3.select(edge.elem).on('contextmenu', e => {
  //         e.preventDefault();
  //         const from = edg.v.split('/');
  //         const to = edg.w.split('/');
  //         const fromActivityId = from[0];
  //         const outcome = from[1] || to[1];
  //         this.removeConnection(fromActivityId, outcome);
  //       });
  //     });
  //   }

  //   root.selectAll('.node.activity').each((n: any) => {
  //     const node = this.graph.node(n) as any;
  //     const activity = node.activity;
  //     const activityId = activity.activityId;

  //     d3.select(node.elem)
  //       .select('.expand').on('click', e => {
  //         const activityContext = this.activityDisplayContexts[activityId];

  //         if (activityContext) {
  //           activityContext.expanded = !activityContext.expanded;
  //         }
  //     });

  //     d3.select(node.elem).on('click', e => {
  //       // If a parent activity was selected to connect to:
  //       if (this.mode == WorkflowDesignerMode.Edit && this.parentActivityId && this.parentActivityOutcome) {
  //         this.addConnection(this.parentActivityId, activityId, this.parentActivityOutcome);
  //       } else {
  //         // When clicking an activity with shift:
  //         if (e.shiftKey) {
  //           if (!!this.selectedActivities[activityId])
  //             delete this.selectedActivities[activityId];
  //           else {
  //             this.selectedActivities[activityId] = activity;
  //             this.activitySelected.emit(activity);
  //           }
  //         }
  //         // When clicking an activity:
  //         else {
  //           if (!!this.selectedActivities[activityId])
  //             delete this.selectedActivities[activityId];
  //           else {
  //             for (const key in this.selectedActivities) {
  //               this.activityDeselected.emit(this.selectedActivities[key]);
  //             }
  //             this.selectedActivities = {};
  //             this.selectedActivities[activityId] = activity;
  //             this.activitySelected.emit(activity);
  //           }
  //         }

  //         // Delay the rerender of the tree to permit the double click action to be captured
  //         setTimeout(() => {
  //           this.safeRender();
  //         }, 90);
  //       }
  //     }).on('dblclick', async e => {
  //       e.stopPropagation();
  //       if (this.mode == WorkflowDesignerMode.Edit) {
  //         await this.showActivityEditor(activity, true);
  //         if (!this.selectedActivities[activityId]) {
  //           for (const key in this.selectedActivities) {
  //             this.activityDeselected.emit(this.selectedActivities[key]);
  //           }
  //           this.selectedActivities = {};
  //           this.selectedActivities[activityId] = activity;
  //           this.activitySelected.emit(activity);
  //           this.safeRender();
  //         }
  //       }
  //     });

  //     if (this.mode == WorkflowDesignerMode.Edit || this.mode == WorkflowDesignerMode.Instance) {
  //       d3.select(node.elem)
  //         .select('.context-menu-button-container button')
  //         .on('click', evt => {
  //           evt.stopPropagation();
  //           this.handleContextMenuChange({
  //             x: evt.clientX,
  //             y: evt.clientY,
  //             shown: true,
  //             activity: node.activity,
  //             selectedActivities: this.selectedActivities
  //           });
  //         });
  //     }
  //     else if (this.mode == WorkflowDesignerMode.Test) {
  //       d3.select(node.elem)
  //         .select('.context-menu-button-container button')
  //         .on('click', evt => {
  //           evt.stopPropagation();
  //           this.handleContextMenuTestChange({x: evt.clientX, y: evt.clientY, shown: true, activity: node.activity});
  //         });
  //     }
  //   });
  // }

  // renderTree() {
  //   this.applyZoom();
  //   this.setEntities();
  //   this.renderNodes();
  // }

  createActivityOptions(activity: ActivityModel) {
    return {
      shape: 'rect',
      label: this.renderActivity(activity),
      rx: 5,
      ry: 5,
      labelType: 'html',
      class: 'activity',
      activity,
    };
  }

  createOutcomeActivityOptions() {
    return {shape: 'circle', label: this.renderOutcomeButton(), labelType: 'html', class: 'add', width: 32, height: 32};
  }

  renderOutcomeButton() {
    const cssClass = this.mode == WorkflowDesignerMode.Edit ? 'hover:elsa-text-blue-500 elsa-cursor-pointer' : 'elsa-cursor-default';
    return `<svg class="elsa-h-8 elsa-w-8 elsa-text-gray-400 ${cssClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`;
  }

  renderActivity(activity: ActivityModel) {
    const activityDisplayContexts = this.activityDisplayContexts || {};
    const displayContext = activityDisplayContexts[activity.activityId] || undefined;
    const activityContextMenuButton = !!this.activityContextMenuButton ? this.activityContextMenuButton(activity) : '';
    const activityBorderColor = !!this.activityBorderColor ? this.activityBorderColor(activity) : 'gray';
    const selectedColor = !!this.activityBorderColor ? activityBorderColor : 'blue';
    const cssClass = !!this.selectedActivities[activity.activityId] ? `elsa-border-${selectedColor}-600` : `elsa-border-${activityBorderColor}-200 hover:elsa-border-${selectedColor}-600`;
    const displayName = displayContext != undefined ? displayContext.displayName : activity.displayName;
    const typeName = activity.type;
    const expanded = displayContext && displayContext.expanded;

    return `<div class="elsa-border-2 elsa-border-solid ${cssClass}">
      <div class="elsa-p-3">
        <div class="elsa-flex elsa-justify-between elsa-space-x-4">
          <div class="elsa-flex-shrink-0">
            ${displayContext?.activityIcon || ''}
          </div>
          <div class="elsa-flex-1 elsa-font-medium elsa-leading-8 elsa-overflow-hidden">
            <p class="elsa-overflow-ellipsis elsa-text-base">${displayName}</p>
            ${typeName !== displayName ? `<p class="elsa-text-gray-400 elsa-text-sm">${typeName}</p>` : ''}
          </div>
          <div class="elsa--mt-2">
            <div class="context-menu-button-container">
              ${activityContextMenuButton}
            </div>
            <button type="button" class="expand elsa-ml-1 elsa-text-gray-400 elsa-rounded-full elsa-bg-transparent hover:elsa-text-gray-500 focus:elsa-outline-none focus:elsa-text-gray-500 focus:elsa-bg-gray-100 elsa-transition elsa-ease-in-out elsa-duration-150">
              ${!expanded ? `<svg xmlns="http://www.w3.org/2000/svg" class="elsa-w-6 elsa-h-6 elsa-text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>` : ''}
              ${expanded ? `<svg xmlns="http://www.w3.org/2000/svg" class="elsa-h-6 elsa-w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>` : ''}
            </button>
          </div>
        </div>
        ${this.renderActivityBody(displayContext)}
      </div>
    </div>`;
  }

  renderActivityBody(displayContext: ActivityDesignDisplayContext) {
    if (displayContext && displayContext.expanded) {
      return (
        `<div class="elsa-border-t elsa-border-t-solid">
          <div class="elsa-p-4 elsa-text-gray-400 elsa-text-sm">
            <div class="elsa-mb-2">${!!displayContext?.bodyDisplay ? displayContext.bodyDisplay : ''}</div>
            <div>
              <span class="elsa-inline-flex elsa-items-center elsa-px-2.5 elsa-py-0.5 elsa-rounded-full elsa-text-xs elsa-font-medium elsa-bg-gray-100 elsa-text-gray-500">
                <svg class="-elsa-ml-0.5 elsa-mr-1.5 elsa-h-2 elsa-w-2 elsa-text-gray-400" fill="currentColor" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="3" />
                </svg>
                ${displayContext != undefined ? displayContext.activityModel.activityId : ''}
              </span>
            </div>
          </div>
        </div>`
      );
    }

    return '';
  }


  render() {

    return (
      <Host>
        {this.mode == WorkflowDesignerMode.Edit && <button type="button" onClick={ e => this.onAddActivity(e)} class="start-btn elsa-absolute elsa-z-1 elsa-h-12 elsa-px-6 elsa-border elsa-border-transparent elsa-text-base elsa-font-medium elsa-rounded-md elsa-text-white elsa-bg-green-600 hover:elsa-bg-green-500 focus:elsa-outline-none focus:elsa-border-green-700 focus:elsa-shadow-outline-green active:elsa-bg-green-700 elsa-transition elsa-ease-in-out elsa-duration-150 elsa-translate-x--1/2 elsa-top-8">Add activity</button>}
        <div class="workflow-canvas elsa-flex-1 elsa-flex" ref={el => (this.el = el)}>
          {this.mode == WorkflowDesignerMode.Test ?
            <div>
              <div id="left" style={{border:`4px solid orange`, position:`fixed`, height: `calc(100vh - 64px)`, width:`4px`, top:`64`, bottom:`0`, left:`0`}}/>
              <div id="right" style={{border:`4px solid orange`, position:`fixed`, height: `calc(100vh - 64px)`, width:`4px`, top:`64`, bottom:`0`, right:`0`}}/>
              <div id="top" style={{border:`4px solid orange`, position:`fixed`, height:`4px`, left:`0`, right:`0`, top:`30`}}/>
              <div id="bottom" style={{border:`4px solid orange`, position:`fixed`, height:`4px`, left:`0`, right:`0`, bottom:`0`}}/>
            </div>
            :
            undefined
          }

          <div ref={el => (this.container = el)}></div>
        </div>
      </Host>
    );
  }

  private getLayoutDirection = () => {
    switch (this.layoutDirection) {
      case LayoutDirection.BottomTop:
        return 'BT';
      case LayoutDirection.LeftRight:
        return 'LR';
      case LayoutDirection.RightLeft:
        return 'RL';
      case LayoutDirection.TopBottom:
      default:
        return 'TB';
    }
  }
}
