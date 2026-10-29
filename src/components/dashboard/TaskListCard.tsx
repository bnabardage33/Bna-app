"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";

interface Task {
  id: string;
  title: string;
  subtext: string;
  done: boolean;
}

const initialTasks: Task[] = [
  {
    id: "1",
    title: "Confirmer la livraison",
    subtext: "Martin · avant 10 h",
    done: false,
  },
  {
    id: "2",
    title: "Relancer le devis Dupont",
    subtext: "Aujourd’hui",
    done: false,
  },
];

export const TaskListCard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const remainingCount = tasks.filter((t) => !t.done).length;

  return (
    <section className="bg-white border border-bna-border rounded-2xl p-4 shadow-xs mt-3">
      <div className="flex items-center justify-between pb-2 border-b border-bna-border/50">
        <b className="text-[11px] font-bold tracking-wider text-bna-muted uppercase">
          À FAIRE AUJOURD’HUI
        </b>
        <span className="bg-bna-copper-light text-bna-copper-dark font-semibold rounded-full px-2.5 py-0.5 text-xs">
          {remainingCount}
        </span>
      </div>

      <div className="divide-y divide-bna-border/40">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => toggleTask(task.id)}
            className="flex items-start gap-3 py-3 cursor-pointer group select-none"
          >
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 transition-colors ${
                task.done
                  ? "bg-bna-copper border-bna-copper text-white"
                  : "border-bna-muted/60 group-hover:border-bna-copper"
              }`}
            >
              {task.done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-medium transition-colors ${
                  task.done
                    ? "line-through text-bna-muted"
                    : "text-bna-anthracite"
                }`}
              >
                {task.title}
              </p>
              <p className="text-xs text-bna-muted mt-0.5">{task.subtext}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
