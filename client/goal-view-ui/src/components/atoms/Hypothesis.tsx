import { FunctionComponent } from "react";

import { PpDisplay, PpString } from "pp-display";
import classes from "./PpString.module.css";

type HypothesisProps = {
    anchor: string;
    content: PpString;
    maxDepth: number;
};

const hypothesis: FunctionComponent<HypothesisProps> = (props) => {
    const { anchor, content, maxDepth } = props;

    return (
        <div className={classes.Hypothesis} data-proof-anchor={anchor}>
            <PpDisplay pp={content} rocqCss={classes} maxDepth={maxDepth} />
        </div>
    );
};

export default hypothesis;
