import { FunctionComponent } from "react";

import { CollapsibleGoal } from "../../types";
import CollapsibleGoalBlock from "../molecules/CollapsibleGoalBlock";

import classes from "./GoalCollapsibles.module.css";

type GoalSectionProps = {
    goals: CollapsibleGoal[];
    collapseGoalHandler: (id: string) => void;
    toggleContextHandler: (id: string) => void;
    maxDepth: number;
    helpMessageHandler: (message: string) => void;
};

const goalSection: FunctionComponent<GoalSectionProps> = (props) => {
    const {
        goals,
        collapseGoalHandler,
        toggleContextHandler,
        maxDepth,
        helpMessageHandler,
    } = props;
    const goalCollapsibles = goals.map((goal, index) => {
        return (
            <CollapsibleGoalBlock
                key={goal.id}
                goal={goal}
                goalIndex={index + 1}
                goalIndicator={index + 1 + " / " + goals.length}
                collapseHandler={collapseGoalHandler}
                toggleContextHandler={toggleContextHandler}
                maxDepth={maxDepth}
                helpMessageHandler={helpMessageHandler}
            />
        );
    });

    return <div className={classes.Collapsibles}>{goalCollapsibles}</div>;
};

export default goalSection;
