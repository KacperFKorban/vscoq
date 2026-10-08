import { FunctionComponent } from "react";

import { PpDisplay, PpString } from "pp-display";
import classes from "./PpString.module.css";

type GoalProps = {
    goalId: string;
    goal: PpString;
    maxDepth: number;
    setHelpMessage: (message: string) => void;
};

const goal: FunctionComponent<GoalProps> = (props) => {
    const { goalId, goal, maxDepth, setHelpMessage } = props;

    return (
        <div
            className={classes.Goal}
            data-proof-anchor={JSON.stringify([goalId, "goal"])}
            onMouseOver={() => {
                if (setHelpMessage !== undefined) {
                    setHelpMessage(
                        "Click on the window and keep Alt pressed in to enable term eliding/expanding.",
                    );
                }
            }}
            onMouseOut={() => {
                if (setHelpMessage !== undefined) {
                    setHelpMessage("");
                }
            }}
        >
            <PpDisplay pp={goal} rocqCss={classes} maxDepth={maxDepth} />
        </div>
    );
};

export default goal;
