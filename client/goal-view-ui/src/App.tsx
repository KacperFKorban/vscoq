import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import "./App.css";

import ProofViewPage from "./components/templates/ProofViewPage";
import {
    Goal,
    ProofViewGoals,
    ProofViewGoalsKey,
    ProofViewMessage,
    VSCodeMessage,
} from "./types";

import {
    captureScrollAnchor,
    restoreScrollAnchor,
    ScrollAnchor,
} from "./utilities/scrollAnchor";
import { vscode } from "./utilities/vscode";

const app = () => {
    const [goals, setGoals] = useState<ProofViewGoals>(null);
    const [messages, setMessages] = useState<ProofViewMessage[]>([]);
    const [goalDisplaySetting, setGoalDisplaySetting] = useState<
        "List" | "Tabs"
    >("List");
    const [goalDepth, setGoalDepth] = useState<number>(10);
    const [helpMessage, setHelpMessage] = useState<string>("");
    const pendingScroll = useRef<ScrollAnchor | null>(null);

    const handleMessage = useCallback((msg: { data: VSCodeMessage }) => {
        switch (msg.data.command) {
            case "updateDisplaySettings":
                setGoalDisplaySetting(msg.data.display);
                break;
            case "updateGoalDepth":
                setGoalDepth(msg.data.maxDepth);
                break;
            case "renderProofView":
                pendingScroll.current = captureScrollAnchor();
                const allGoals = msg.data.proofView.proof;
                const messages = msg.data.proofView.messages;
                setMessages(messages);
                setGoals(
                    allGoals === null
                        ? allGoals
                        : {
                              main: allGoals.goals.map(
                                  (goal: Goal, index: number) => {
                                      return {
                                          ...goal,
                                          isOpen: true,
                                          isContextHidden: index !== 0,
                                      };
                                  },
                              ),
                              shelved: allGoals.shelvedGoals.map(
                                  (goal: Goal, index: number) => {
                                      return {
                                          ...goal,
                                          isOpen: true,
                                          isContextHidden: index !== 0,
                                      };
                                  },
                              ),
                              givenUp: allGoals.givenUpGoals.map(
                                  (goal: Goal, index: number) => {
                                      return {
                                          ...goal,
                                          isOpen: true,
                                          isContextHidden: index !== 0,
                                      };
                                  },
                              ),
                              unfocused: allGoals.unfocusedGoals.map(
                                  (goal: Goal, index: number) => {
                                      return {
                                          ...goal,
                                          isOpen: false,
                                          isContextHidden: index !== 0,
                                      };
                                  },
                              ),
                          },
                );
                break;
            case "reset":
                pendingScroll.current = null;
                setMessages([]);
                setGoals(null);
                break;
        }
    }, []);

    useEffect(() => {
        window.addEventListener("message", handleMessage);
        const cancelRestore = () => {
            pendingScroll.current = null;
        };
        for (const event of [
            "wheel",
            "touchmove",
            "pointerdown",
            "keydown",
            "click",
        ]) {
            window.addEventListener(event, cancelRestore, { capture: true });
        }
        vscode.postMessage({ command: "pollGoals" });
        vscode.postMessage({ command: "pollDisplaySettings" });
        return () => {
            window.removeEventListener("message", handleMessage);
            for (const event of [
                "wheel",
                "touchmove",
                "pointerdown",
                "keydown",
                "click",
            ]) {
                window.removeEventListener(event, cancelRestore, {
                    capture: true,
                });
            }
        };
    }, [handleMessage]);

    useLayoutEffect(() => {
        if (pendingScroll.current) {
            restoreScrollAnchor(pendingScroll.current);
            pendingScroll.current = null;
        }
    }, [goals]);

    const collapseGoalHandler = (id: string, key: ProofViewGoalsKey) => {
        const newGoals = goals![key].map((goal) => {
            if (goal.id === id) {
                return { ...goal, isOpen: !goal.isOpen };
            }
            return goal;
        });
        setGoals({
            ...goals!,
            [key]: newGoals,
        });
    };

    const toggleContext = (id: string, key: ProofViewGoalsKey) => {
        const newGoals = goals![key].map((goal) => {
            if (goal.id === id) {
                return { ...goal, isContextHidden: !goal.isContextHidden };
            }
            return goal;
        });
        setGoals({
            ...goals!,
            [key]: newGoals,
        });
    };

    const settingsClickHandler = () => {
        vscode.postMessage({
            command: "openGoalSettings",
        });
    };

    return (
        <main>
            <ProofViewPage
                goals={goals}
                messages={messages}
                collapseGoalHandler={collapseGoalHandler}
                displaySetting={goalDisplaySetting}
                maxDepth={goalDepth}
                settingsClickHandler={settingsClickHandler}
                helpMessage={helpMessage}
                helpMessageHandler={(message: string) =>
                    setHelpMessage(message)
                }
                toggleContextHandler={toggleContext}
            />
        </main>
    );
};

export default app;
