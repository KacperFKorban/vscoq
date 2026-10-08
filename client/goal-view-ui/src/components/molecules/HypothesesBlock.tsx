import { FunctionComponent } from "react";

import { stringOfPpString } from "pp-display";
import { Goal } from "../../types";

import Hypothesis from "../atoms/Hypothesis";

import classes from "./HypothesesBlock.module.css";

type HypothesesBlockProps = {
    goal: Goal;
    maxDepth: number;
};

const hypothesesBlock: FunctionComponent<HypothesesBlockProps> = (props) => {
    const { goal, maxDepth } = props;

    const hypothesesComponents = goal.hypotheses.map((hyp, index) => {
        const name = stringOfPpString(hyp).trimStart().split(/[\s,:]/, 1)[0];
        const anchor = JSON.stringify([goal.id, "hypothesis", name]);
        return (
            <Hypothesis
                key={index}
                anchor={anchor}
                content={hyp}
                maxDepth={maxDepth}
            />
        );
    });

    return <ul className={classes.Block}>{hypothesesComponents}</ul>;
};

export default hypothesesBlock;
