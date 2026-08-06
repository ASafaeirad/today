import { useState, useEffect } from "react";

import { StoryMatrix } from "#storybook/matrix";
import preview from "#storybook/preview";

import { Progressbar, ProgressLabel, ProgressValue } from "./Progressbar";

const meta = preview.meta({
  component: Progressbar,
});

const values = [0, 25, 50, 75, 100] as const;

export const Matrix = meta.story({
  render: () => (
    <StoryMatrix
      columns={[{ label: "Plain" }, { label: "With Label" }]}
      rows={values.map((v) => `${v}%`)}
      cell={({ row, col }) => {
        const value = parseInt(row);
        return (
          <div className="w-56">
            <Progressbar value={value}>
              {col === "With Label" && (
                <>
                  <ProgressLabel>{row}</ProgressLabel>
                  <ProgressValue />
                </>
              )}
            </Progressbar>
          </div>
        );
      }}
    />
  ),
});

export const Animated = meta.story({
  render: () => {
    const [progress, setProgress] = useState(13);

    useEffect(() => {
      const timer = setTimeout(() => setProgress(66), 500);
      return () => clearTimeout(timer);
    }, []);

    return <Progressbar value={progress} className="min-w-md" />;
  },
});
